import { Scheduler } from './scheduler';
import { ComponentDescriptor, IL } from '@composita/il';
import { Optional } from '@composita/ts-utility-types';
import { Task } from './tasks';
import { Interpreter } from './interpreter';
import { BidirectionalConnection, SystemHandle } from './syscallhandler';
import { ActiveValue, ArrayVariableValue, ComponentValue, ProcedureValue, ServiceValue, VariableValue } from './values';

export class Runtime implements SystemHandle {
    private constructor() {
        /* prevent creating multiple runtimes. */
    }

    static getInstance(): Runtime {
        if (this.instance === undefined) {
            this.instance = new Runtime();
        }
        return this.instance;
    }

    private static instance: Optional<Runtime> = undefined;

    private scheduler: Scheduler = new Scheduler();
    private nextTaskId = 0;
    private stop = false;

    private out: (...msgs: Array<string>) => void = (...msgs: Array<string>) =>
        msgs.forEach((msg) => process.stdout.write(msg));

    reset(): void {
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

    async time(): Promise<number> {
        return new Date().getMilliseconds();
    }

    private currentIl: Optional<IL> = undefined;

    async execute(il: IL): Promise<void> {
        this.stop = false;
        this.currentIl = il;
        this.run();
    }

    run(): void {
        this.isRunning(true);
        this.currentIl?.entryPoints.forEach((descriptor) => {
            const component = this.createComponent(descriptor, undefined);
            this.register(component);
        });
        let task = this.scheduler.getActiveTask();
        while (task !== undefined && !this.stop) {
            task.execute();
            task = this.scheduler.getActiveTask();
        }
        this.isRunning(false);
    }

    print(...msgs: Array<string>): void {
        this.out(...msgs);
    }

    createComponent(type: ComponentDescriptor, container: Optional<ActiveValue>): ComponentValue {
        const component = new ComponentValue(type, container);
        type.declarations.variables.forEach((descriptor) => {
            if (descriptor.indexTypes.length > 0) {
                component.variables.push(new ArrayVariableValue(descriptor, new Map()));
            } else {
                component.variables.push(new VariableValue(descriptor, undefined, descriptor.mutable));
            }
        });
        type.declarations.procedures.forEach((descriptor) =>
            component.procedures.push(new ProcedureValue(descriptor, component)),
        );
        type.implementations.forEach((descriptor) => component.services.push(new ServiceValue(descriptor, component)));
        return component;
    }

    register(active: ActiveValue): void {
        const interpreter = new Interpreter(this, active);
        const task = new Task(this.nextTaskId++, interpreter);
        this.scheduler.enqueue(task);
    }

    connect(client: ServiceValue, server: ServiceValue): BidirectionalConnection {
        client;
        server;
        throw new Error('Method not implemented.');
    }

    disconnect(client: ServiceValue): void {
        client;
        throw new Error('Method not implemented.');
    }
}
