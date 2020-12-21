import { Optional } from '@composita/ts-utility-types';
import { Runtime } from './runtime';
import { PointerValue } from './values';

export class Scheduler {
    private active: Optional<PointerValue> = undefined;
    private ready: Array<PointerValue> = new Array<PointerValue>();

    enqueue(work: PointerValue): void {
        this.ready.push(work);
    }

    getNext(): Optional<PointerValue> {
        // simple scheduling, just loop through all the tasks.
        this.scheduleNext();
        return this.active;
    }

    getActive(): Optional<PointerValue> {
        return this.active;
    }

    private scheduleNext(): void {
        if (this.active !== undefined && !Runtime.instance().load(this.active).isDone()) {
            this.ready.push(this.active);
        }
        this.active = this.ready.shift();
    }
}
