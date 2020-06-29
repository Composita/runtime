import { Optional } from '@composita/ts-utility-types';
import { Message } from '@composita/il';

export class Mailbox {
    constructor(public readonly ownerId: number) {}

    private element: Optional<Message> = undefined;

    empty(): boolean {
        return this.element === undefined;
    }

    check(): Optional<Message> {
        return this.element;
    }

    put(record: Message): void {
        this.element = record;
    }

    get(): Optional<Message> {
        const retValue = this.element;
        this.element = undefined;
        return retValue;
    }
}
