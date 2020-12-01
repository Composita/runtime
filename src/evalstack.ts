import { BuiltInValue, ComponentValue, ServiceValue, VariableValues } from './values';

export type StackValue = ComponentValue | VariableValues | ServiceValue | BuiltInValue;

export class EvaluationStack {
    private readonly stack = new Array<StackValue>();

    pop(): StackValue {
        if (this.stack.length === 0) {
            throw new Error('Pop called on empty evaluation stack.');
        }
        const value = this.stack.pop();
        if (value === undefined) {
            throw new Error('Undefined value on stack.');
        }
        return value;
    }

    push(data: StackValue): void {
        this.stack.push(data);
    }
}
