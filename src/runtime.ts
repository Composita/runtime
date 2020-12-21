import { Scheduler } from './scheduler';
import {
    BooleanDescriptor,
    CharacterDescriptor,
    ComponentDescriptor,
    DeclarationDescriptor,
    FloatDescriptor,
    IL,
    IntegerDescriptor,
    InterfaceDescriptor,
    MessageDescriptor,
    ProcedureDescriptor,
    TextDescriptor,
    TypeDescriptor,
} from '@composita/il';
import { getOrThrow, Optional } from '@composita/ts-utility-types';
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
import { Interpreter } from './interpreter';
import { default as equal } from 'fast-deep-equal';

export class Runtime {
    private constructor() {
        /* private for singleton use */
    }

    private readonly scheduler: Scheduler = new Scheduler();
    private readonly interpreter: Interpreter = new Interpreter();
    private nextTaskId = 0;
    private stop = false;

    private readonly memory = new Map<PointerValue, ActiveValue>();
    private readonly objectDependency = new Map<PointerValue, PointerValue>(); // key: child, value: parent

    // hack for now
    public static readonly finishMessage = new MessageValue(new MessageDescriptor('FINISH'));
    public static readonly anyMessage = new MessageValue(new MessageDescriptor('ANY'));

    private out: (...msgs: Array<string>) => void = (...msgs: Array<string>) =>
        msgs.forEach((msg) => process.stdout.write(msg));

    private static runtime: Runtime = new Runtime();

    static instance(): Runtime {
        return Runtime.runtime;
    }

    reset(): void {
        Runtime.runtime = new Runtime();
    }

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
        let next = this.scheduler.getNext();
        while (next !== undefined && !this.stop) {
            await this.interpreter.process(next);
            next = this.scheduler.getNext();
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
        this.scheduler.enqueue(pointer);
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

    private interfaceToService = new Map<InterfaceDescriptor, Map<ComponentPointer, ServicePointer>>();
    private serviceToComponent = new Map<ServicePointer, ComponentPointer>();

    // loads or create a service if it does not yet exist.
    getService(type: InterfaceDescriptor, container: ComponentPointer): ServicePointer | UndefinedValue {
        const mapping = this.interfaceToService.get(type);
        if (mapping === undefined) {
            throw new Error('Interface not defined for service.');
        }
        const component = this.memory.get(container);
        if (!(component instanceof ComponentValue)) {
            throw new Error('Component not in memory.');
        }

        if (mapping.has(container)) {
            return mapping.get(container) as ServicePointer;
        }

        const servicePointer = new ServicePointer(this.nextTaskId++, type);
        this.serviceToComponent.set(servicePointer, container);
        mapping.set(container, servicePointer);
        return servicePointer;
    }

    private readonly clientToServer = new Map<ComponentPointer, Array<ServicePointer>>();

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

    connect(toPtr: ComponentPointer, service: ServicePointer): void {
        const toValue = this.memory.get(toPtr);
        const fromPtr = this.serviceToComponent.get(service);
        if (!(fromPtr instanceof ComponentPointer)) {
            throw new Error('From does not point to valid component.');
        }
        const fromValue = this.memory.get(fromPtr);

        if (!(fromValue instanceof ComponentValue)) {
            throw new Error('connect: "From" must be a component value.');
        }

        if (!(toValue instanceof ComponentValue)) {
            throw new Error('connect: "To" must be a component value.');
        }

        const toImpl = toValue.descriptor.implementations.find((desc) => equal(desc.reference, service.type));
        const fromImpl = fromValue.descriptor.implementations.find((desc) => equal(desc.reference, service.type));
        const implementation = toImpl === undefined ? fromImpl : toImpl;

        if (this.memory.has(service)) {
            // just ignore it for now and return
            throw new Error('Service already connected.');
        }

        if (implementation === undefined) {
            throw new Error('Implementation undefined.');
        }

        const mapping = this.interfaceToService.get(service.type);
        if (mapping === undefined) {
            throw new Error('Interface not defined for service.');
        }

        let parent: Optional<ComponentPointer> = undefined;
        if (toImpl !== undefined) {
            toValue.offerConnections.get(service.type)?.push(service);
            fromValue.requiredConnections.get(service.type)?.push(service);
            parent = toPtr;
        }

        if (fromImpl !== undefined) {
            fromValue.offerConnections.get(service.type)?.push(service);
            toValue.requiredConnections.get(service.type)?.push(service);
            parent = fromPtr;
        }

        if (parent === undefined) {
            throw new Error('Unknown service parent!');
        }

        const serviceValue = new ServiceValue(implementation, parent);
        this.prepareDeclarations(implementation.declarations, serviceValue, service);
        this.memory.set(service, serviceValue);
        mapping.set(toPtr, service);
        mapping.set(fromPtr, service);
        this.scheduler.enqueue(service);
    }

    private createProcedure(type: ProcedureDescriptor, pointer: PointerValue): ProcedureValue {
        const value = getOrThrow(this.memory.get(pointer));
        const procedure = new ProcedureValue(type, pointer, value.evalStack);
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
