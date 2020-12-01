import { Optional } from '@composita/ts-utility-types';
import { Task, TaskState } from './tasks';

export class Scheduler {
    private activeTask: Optional<Task> = undefined;
    private readyTasks: Array<Task> = new Array<Task>();

    enqueue(task: Task): void {
        this.readyTasks.push(task);
    }

    getActiveTask(): Optional<Task> {
        // simple scheduling, just loop through all the tasks.
        this.scheduleNext();
        return this.activeTask;
    }

    killTask(id: number): void {
        // TODO probably something more sofisticated.
        this.readyTasks = this.readyTasks.filter((task) => task.id !== id);
    }

    private scheduleNext(): void {
        if (this.activeTask !== undefined && this.activeTask.getState() !== TaskState.Done) {
            this.readyTasks.push(this.activeTask);
        }
        this.activeTask?.pause();
        this.activeTask = this.readyTasks.shift();
    }
}
