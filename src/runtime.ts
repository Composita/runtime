import { Scheduler } from './scheduler';
import {
    BooleanDescriptor,
    CharacterDescriptor,
    ComponentDescriptor,
    DeclarationDescriptor,
    FloatDescriptor,
    IL,
    ImplementationDescriptor,
    IntegerDescriptor,
    InterfaceDescriptor,
    MessageDescriptor,
    ProcedureDescriptor,
    TextDescriptor,
    TypeDescriptor,
} from '@composita/il';
import { Optional } from '@composita/ts-utility-types';
import {
    ActiveValue,
    ArrayVariableValue,
    BooleanValue,
    CharacterValue,
    ComponentPointer,
    ComponentValue,
    FloatValue,
    IntegerValue,
    MessageValue,
    PointerValue,
    ProcedurePointer,
    ProcedureValue,
    RootPointer,
    ServicePointer,
    ServiceValue,
    TextValue,
    UndefinedValue,
    VariableValue,
    VariableValueType,
} from './values';
import { Task } from './tasks';
import { Interpreter } from './interpreter';
import { default as equal } from 'fast-deep-equal';

export class Runtime {
    private scheduler: Scheduler = new Scheduler();
    private nextTaskId = 0;
    private stop = false;

    private memory = new Map<PointerValue, ActiveValue>();
    private objectDependency = new Map<PointerValue, PointerValue>(); // key: child, value: parent

    // hack for now
    public static readonly finishMessage = new MessageValue(new MessageDescriptor('FINISH'));
    public static readonly anyMessage = new MessageValue(new MessageDescriptor('ANY'));

    private out: (...msgs: Array<string>) => void = (...msgs: Array<string>) =>
        msgs.forEach((msg) => process.stdout.write(msg));

    halt(): void {
        this.stop = true;
    }

    changeOutput(out: (...msg: Array<string>) => void): void {
        this.out = out;
    }

    private isRunning: (running: boolean) => void = () => {
        /* */
    };

    isRunningUpdate(fn: (running: boolean) => void): void {
        this.isRunning = fn;
    }

    async run(il: IL): Promise<void> {
        this.stop = false;
        this.isRunning(true);
        il.entryPoints.forEach((descriptor) => {
            this.createComponent(descriptor, new RootPointer());
        });
        let task = this.scheduler.getNextTask();
        while (task !== undefined && !this.stop) {
            await task.execute();
            task = this.scheduler.getNextTask();
        }
        this.isRunning(false);
    }

    private exclusiveLock: Optional<number> = undefined;
    static holderId = 0;

    acquireExclusive(oldId: Optional<number>): Optional<number> {
        if (this.exclusiveLock === oldId && oldId !== undefined) {
            return oldId;
        }
        if (this.exclusiveLock !== undefined) {
            return undefined;
        }
        this.exclusiveLock = Runtime.holderId;
        Runtime.holderId++;
        return this.exclusiveLock;
    }

    releaseExclusive(id: Optional<number>): boolean {
        if (this.exclusiveLock !== undefined && id === undefined) {
            return false;
        }
        if (this.exclusiveLock !== id) {
            return false;
        }
        this.exclusiveLock = undefined;
        return true;
    }

    print(...msgs: Array<string>): void {
        this.out(...msgs);
    }

    time(): number {
        return new Date().getMilliseconds();
    }

    load(pointer: PointerValue): ActiveValue {
        const value = this.tryLoad(pointer);
        if (value === undefined) {
            throw new Error('Failed to load value.');
        }
        return value;
    }

    tryLoad(pointer: PointerValue): Optional<ActiveValue> {
        return this.memory.get(pointer);
    }

    private getDefaultVariableValue(type: TypeDescriptor): VariableValueType {
        if (type instanceof IntegerDescriptor) {
            return new IntegerValue();
        }
        if (type instanceof FloatDescriptor) {
            return new FloatValue();
        }
        if (type instanceof TextDescriptor) {
            return new TextValue();
        }
        if (type instanceof CharacterDescriptor) {
            return new CharacterValue();
        }
        if (type instanceof BooleanDescriptor) {
            return new BooleanValue();
        }
        return new UndefinedValue(type);
    }

    createComponent(type: ComponentDescriptor, container: PointerValue): ComponentPointer {
        const pointer = new ComponentPointer(this.nextTaskId++, type);
        const component = new ComponentValue(type, container);
        this.objectDependency.set(pointer, container);
        this.memory.set(pointer, component);
        this.registerTask(pointer);
        this.prepareDeclarations(type.declarations, component, pointer);
        type.offers.forEach((offer) => {
            if (!this.interfaceToService.has(offer)) {
                this.interfaceToService.set(offer, new Map());
            }
        });
        type.requires.forEach((require) => {
            if (!this.interfaceToService.has(require)) {
                this.interfaceToService.set(require, new Map());
            }
        });
        return pointer;
    }

    private registerTask(pointer: PointerValue): void {
        const interpreter = new Interpreter(this, pointer);
        const task = new Task(pointer, interpreter);
        this.scheduler.enqueue(task);
    }

    private interfaceToService = new Map<InterfaceDescriptor, Map<ComponentPointer, ServicePointer>>();
    private serviceToImpl = new Map<ServicePointer, ComponentPointer>();

    // loads or create a service if it does not yet exist.
    getService(type: InterfaceDescriptor, container: ComponentPointer): ServicePointer {
        const mapping = this.interfaceToService.get(type);
        if (mapping === undefined) {
            throw new Error('Interface not defined for service.');
        }
        const component = this.memory.get(container);
        if (!(component instanceof ComponentValue)) {
            throw new Error('Component not in memory.');
        }
        const implDesc = component.descriptor.implementations.find((desc) => equal(desc.reference, type));

        if (mapping.has(container)) {
            return mapping.get(container) as ServicePointer;
        }

        if (implDesc !== undefined) {
            const servicePointer = new ServicePointer(this.nextTaskId++, type);
            this.serviceToImpl.set(servicePointer, container);
            mapping.set(container, servicePointer);
            return servicePointer;
        }

        const connectedService = component.offerConnections.get(type);
        if (connectedService !== undefined) {
            return connectedService;
        }
        const requiredService = component.requiredConnections.get(type);
        if (requiredService !== undefined) {
            return requiredService;
        }
        throw new Error('No service connected and no implementation found.');
    }

    private readonly clientToServer = new Map<ComponentPointer, Array<ServicePointer>>();

    findService(descriptor: InterfaceDescriptor, root: PointerValue): Optional<ServicePointer> {
        descriptor;
        if (root instanceof RootPointer) {
            return undefined;
        }

        const parent = this.objectDependency.get(root);
        if (parent === undefined) {
            throw new Error('Pointer without a parent.');
        }

        if (root instanceof ProcedurePointer) {
            return this.findService(descriptor, parent);
        }

        const value = this.memory.get(root);
        if (root instanceof ServicePointer) {
            if (value instanceof ServiceValue && equal(value.descriptor.reference, descriptor)) {
                return root;
            }
            return this.findService(descriptor, parent);
        }

        if (value instanceof ComponentPointer) {
            const result = this.clientToServer.get(value)?.filter((pointer) => {
                const memValue = this.memory.get(pointer);
                return memValue instanceof ServiceValue && equal(memValue.descriptor.reference, descriptor);
            });
            return result?.length === 1 ? result[0] : undefined;
        }
        return undefined;
    }

    send(to: ServicePointer, message: MessageValue): void {
        const service = this.memory.get(to);
        if (service === undefined || !(service instanceof ServiceValue)) {
            throw new Error('No service found to send to.');
        }
        service.messageQueue.push(message);
    }

    receive(target: ServicePointer, type: MessageDescriptor): Optional<MessageValue> {
        const service = this.memory.get(target);
        if (service === undefined || !(service instanceof ServiceValue)) {
            throw new Error('No service found to send to.');
        }

        const queue = service.messageQueue;
        if (queue === undefined || queue.length === 0) {
            return undefined;
        }

        const messageDesc = queue[0].descriptor;

        if (equal(messageDesc, type) || equal(type, Runtime.anyMessage) || equal(messageDesc, Runtime.finishMessage)) {
            return queue.shift();
        }

        return undefined;
    }

    receiveTest(target: ServicePointer): Optional<MessageValue> {
        const service = this.memory.get(target);
        if (service === undefined || !(service instanceof ServiceValue)) {
            throw new Error('No service found to send to.');
        }

        const queue = service.messageQueue;
        if (queue === undefined || queue.length === 0) {
            return undefined;
        }

        return queue[0];
    }

    connect(to: ComponentPointer, service: ServicePointer): void {
        const toValue = this.memory.get(to);

        if (!(toValue instanceof ComponentValue)) {
            throw new Error('connect: "To" must be a component value.');
        }

        let impl = toValue.descriptor.implementations.find((desc) => equal(desc.reference, service.type));
        if (impl === undefined && !this.serviceToImpl.has(service)) {
            throw new Error('Impl undefined.');
        }
        if (impl !== undefined) {
            toValue.offerConnections.set(service.type, service);
            const from = this.memory.get(this.serviceToImpl.get(service) as ComponentPointer);
            if (from === undefined || !(from instanceof ComponentValue)) {
                throw new Error('from undefiend when connecting');
            }
            from.requiredConnections.set(service.type, service);
        }
        if (impl === undefined) {
            impl = this.serviceToImpl
                .get(service)
                ?.type.implementations.find((desc) => equal(desc.reference, service.type));
            if (impl === undefined) {
                throw new Error('Implementation not found.');
            }
            toValue.requiredConnections.set(service.type, service);
            const from = this.memory.get(this.serviceToImpl.get(service) as ComponentPointer);
            if (from === undefined || !(from instanceof ComponentValue)) {
                throw new Error('from undefiend when connecting');
            }
            from.offerConnections.set(service.type, service);
        }
        if (!this.memory.has(service)) {
            const serviceValue = this.createService(impl, service);
            this.memory.set(service, serviceValue);
        }
        this.registerTask(service);
    }

    private createService(type: ImplementationDescriptor, pointer: ServicePointer): ServiceValue {
        const service = new ServiceValue(type, this.serviceToImpl.get(pointer) as ComponentPointer);
        this.prepareDeclarations(type.declarations, service, pointer);
        return service;
    }

    private createProcedure(type: ProcedureDescriptor, pointer: PointerValue): ProcedureValue {
        const procedure = new ProcedureValue(type, pointer);
        this.prepareDeclarations(type.declarations, procedure, pointer);
        return procedure;
    }

    private prepareDeclarations(type: DeclarationDescriptor, value: ActiveValue, pointer: PointerValue): void {
        type.variables.forEach((descriptor) => {
            // TODO this is just a hack for now to keep TextDescriptor behavior and needs to be properly handled.
            if (descriptor.indexTypes.length > 0 && !(descriptor.type instanceof TextDescriptor)) {
                value.variables.push(new ArrayVariableValue(descriptor, new Map()));
            } else {
                value.variables.push(new VariableValue(descriptor, this.getDefaultVariableValue(descriptor.type)));
            }
        });
        type.procedures.forEach((descriptor) => {
            const procedurePointer = new ProcedurePointer(this.nextTaskId++, descriptor);
            const procedure = this.createProcedure(descriptor, pointer);
            this.memory.set(procedurePointer, procedure);
            this.objectDependency.set(procedurePointer, pointer);
            value.procedures.push(procedure);
        });
    }

    disconnect(from: ComponentPointer, service: ServicePointer): void {
        const target = this.clientToServer.get(from)?.filter((srv) => !equal(srv, service));
        if (target === undefined) {
            return;
        }
        this.clientToServer.set(from, target);
    }
}
