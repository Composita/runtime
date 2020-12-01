import { Instruction } from '@composita/il';
import { Optional } from '@composita/ts-utility-types';
import { Interpreter } from './interpreter';

export interface Processor {
    load(...code: Array<Instruction>): void;
    processNext(): Promise<void>;
    isDone(): boolean;
}

export enum TaskState {
    Ready,
    Running,
    Paused,
    Done,
}

export class Mailbox<T> {
    private data: Optional<T>;

    post(data: T): void {
        this.data = data;
    }

    receive(): Optional<T> {
        return this.data;
    }

    check(): boolean {
        return this.data !== undefined;
    }
}

export class Task {
    constructor(public readonly id: number, protected interpreter: Interpreter) {}

    private state = TaskState.Ready;

    async execute(): Promise<void> {
        if (this.isDone() || this.interpreter.isDone()) {
            console.log(this.id);
            console.log('DONE DONE DONE');
            this.state = TaskState.Done;
            return;
        }
        this.state = TaskState.Running;
        await this.interpreter.processNext();
    }

    pause(): void {
        if (!this.isDone()) {
            this.state = TaskState.Paused;
        }
    }

    isDone(): boolean {
        return this.state === TaskState.Done;
    }

    getState(): TaskState {
        return this.state;
    }
}
