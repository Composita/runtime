import { Interpreter } from './interpreter';
import { PointerValue } from './values';

export enum TaskState {
    Ready,
    Running,
    Paused,
    Done,
}

export class Task {
    constructor(public readonly value: PointerValue, protected interpreter: Interpreter) {}

    private state = TaskState.Ready;

    execute(): void {
        if (this.isDone() || this.interpreter.isDone()) {
            this.state = TaskState.Done;
            return;
        }
        this.state = TaskState.Running;
        this.interpreter.processNext();
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
