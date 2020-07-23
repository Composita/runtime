import { Scheduler } from '@composita/scheduler';
import { IL, ComponentDescriptor } from '@composita/il';
import { Optional } from '@composita/ts-utility-types';
import { ComponentTask } from '@composita/tasks';
import { SystemCallHandler, Interpreter } from '@composita/interpreter';

export class Runtime implements SystemCallHandler {
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

    private out: (...msgs: Array<string>) => void = (...msgs: Array<string>) =>
        msgs.forEach((msg) => process.stdout.write(msg));

    reset(): void {
        Runtime.instance = new Runtime();
    }

    changeOutput(out: (...msg: Array<string>) => void): void {
        this.out = out;
    }

    async haltProcess(processId: number): Promise<void> {
        this.scheduler.killTask(processId);
    }

    async haltProcessWithCode(processId: number, n: number): Promise<void> {
        await this.print(`Halting process, code ${n}`);
        this.scheduler.killTask(processId);
    }

    async time(): Promise<number> {
        return new Date().getMilliseconds();
    }

    async execute(il: IL): Promise<void> {
        il.getEntryPoints().forEach(async (descriptor) => {
            await this.createTask(descriptor);
        });
        let task = this.scheduler.getActiveTask();
        while (task !== undefined) {
            await task.execute();
            task = this.scheduler.getActiveTask();
        }
    }

    async print(...msgs: Array<string>): Promise<void> {
        this.out(...msgs);
    }

    async createTask(descriptor: ComponentDescriptor): Promise<void> {
        const taskId = this.nextTaskId++;
        const task = new ComponentTask(taskId, new Interpreter(this, taskId), descriptor);
        this.scheduler.enqueue(task);
    }
}
