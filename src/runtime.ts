import { Scheduler } from '@composita/scheduler';
import { IL, ComponentDescriptor, Message } from '@composita/il';
import { Optional } from '@composita/ts-utility-types';
import { Task, ComponentTask } from '@composita/tasks';
import { SystemCallHandler, Interpreter } from '@composita/interpreter';
import { Mailbox } from './mailbox';

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

    private mailboxes: Array<Mailbox> = new Array<Mailbox>();
    private scheduler: Scheduler = new Scheduler();
    private nextTaskId = 0;
    private tasks: Array<Task> = new Array<Task>();

    private out: (...msgs: Array<string>) => void = (...msgs: Array<string>) =>
        msgs.forEach((msg) => process.stdout.write(msg));

    reset(): void {
        Runtime.instance = new Runtime();
    }

    changeOutput(out: (...msg: Array<string>) => void): void {
        this.out = out;
    }

    trySend(record: Message, to: number): boolean {
        if (this.mailboxes.length <= to || !this.mailboxes[to].empty()) {
            return false;
        }
        this.mailboxes[to].put(record);
        return true;
    }

    async time(): Promise<number> {
        return new Date().getMilliseconds();
    }

    async execute(il: IL): Promise<void> {
        il.entryPoints.forEach(async (descriptor) => {
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
        const task = new ComponentTask(this.nextTaskId++, new Interpreter(this), descriptor);
        this.tasks.push(task);
        this.scheduler.enqueue(task);
    }
}

export { Mailbox } from './mailbox';
