import { IntegerDescriptor, SystemCallDescriptor, SystemCallOperation } from '@composita/il';
import { Optional } from '@composita/ts-utility-types';
import { Runtime } from './runtime';
import {
    TextValue,
    CharacterValue,
    FloatValue,
    BooleanValue,
    VariableValue,
    IntegerValue,
    ActiveValue,
    StackValue,
} from './values';

export class SyscallInterpreter {
    private activeValue: Optional<ActiveValue> = undefined;

    private static toValue(value: StackValue): StackValue {
        return value instanceof VariableValue ? value.value : value;
    }

    private handleNoArg(op: SystemCallOperation): void {
        switch (op) {
            case SystemCallOperation.WriteLine:
                Runtime.instance().print('\n');
                return;
        }
        throw new Error(
            `Failed system call '${SystemCallOperation[op]}' and zero argumentss. Operation not supported.`,
        );
    }

    private handleSingleArg(op: SystemCallOperation, value: StackValue): void {
        switch (op) {
            case SystemCallOperation.Write:
                value = SyscallInterpreter.toValue(value);
                if (
                    value instanceof TextValue ||
                    value instanceof CharacterValue ||
                    value instanceof FloatValue ||
                    value instanceof IntegerValue
                ) {
                    Runtime.instance().print(value.value.toString());
                    return;
                }
                break;
            case SystemCallOperation.WriteHex:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof IntegerValue) {
                    Runtime.instance().print(value.value.toString(16));
                    return;
                }
                break;
            case SystemCallOperation.Assert:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof BooleanValue) {
                    if (!value.value) {
                        throw new Error('Assertion failed.');
                    }
                    return;
                }
                break;
            case SystemCallOperation.Halt:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof IntegerValue) {
                    throw new Error(`Halt called. Id: ${value.value}`);
                }
                break;
            case SystemCallOperation.Inc:
                if (value instanceof VariableValue) {
                    const currentValue = value.value;
                    if (currentValue instanceof IntegerValue) {
                        value.value = new IntegerValue(currentValue.value + 1);
                        return;
                    }
                }
                break;
            case SystemCallOperation.Dec:
                if (value instanceof VariableValue) {
                    const currentValue = value.value;
                    if (currentValue instanceof IntegerValue) {
                        value.value = new IntegerValue(currentValue.value - 1);
                        return;
                    }
                }
                break;
            case SystemCallOperation.Passivate:
                // TODO
                console.warn('PASSIVATE syscall not supported');
                return;
            case SystemCallOperation.Count:
                // TODO: not supported yet, defaulting to 1
                console.warn('COUNT syscall not supported');
                return;
            case SystemCallOperation.Length:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof TextValue) {
                    this.activeValue?.evalStack.push(new IntegerValue(value.value.length));
                    return;
                }
                break;
            case SystemCallOperation.Sqrt:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof FloatValue) {
                    this.activeValue?.evalStack.push(new FloatValue(Math.sqrt(value.value)));
                    return;
                }
                break;
            case SystemCallOperation.Sin:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof FloatValue) {
                    this.activeValue?.evalStack.push(new FloatValue(Math.sin(value.value)));
                    return;
                }
                break;
            case SystemCallOperation.Cos:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof FloatValue) {
                    this.activeValue?.evalStack.push(new FloatValue(Math.cos(value.value)));
                    return;
                }
                break;
            case SystemCallOperation.Tan:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof FloatValue) {
                    this.activeValue?.evalStack.push(new FloatValue(Math.tan(value.value)));
                    return;
                }
                break;
            case SystemCallOperation.ArcSin:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof FloatValue) {
                    this.activeValue?.evalStack.push(new FloatValue(Math.asin(value.value)));
                    return;
                }
                break;
            case SystemCallOperation.ArcCos:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof FloatValue) {
                    this.activeValue?.evalStack.push(new FloatValue(Math.acos(value.value)));
                    return;
                }
                break;
            case SystemCallOperation.ArcTan:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof FloatValue) {
                    this.activeValue?.evalStack.push(new FloatValue(Math.atan(value.value)));
                    return;
                }
                break;
            case SystemCallOperation.Min:
                // TODO
                console.warn('MIN call currently only supported for float');
                this.activeValue?.evalStack.push(new FloatValue(Number.MIN_VALUE));
                return;
            case SystemCallOperation.Max:
                // TODO
                console.warn('MAX call currently only supported for float');
                this.activeValue?.evalStack.push(new FloatValue(Number.MAX_VALUE));
                return;
            case SystemCallOperation.ToCharacter:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof IntegerValue) {
                    this.activeValue?.evalStack.push(new CharacterValue(String.fromCharCode(value.value)));
                    return;
                }
                break;
            case SystemCallOperation.ToText:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof CharacterValue) {
                    this.activeValue?.evalStack.push(new TextValue(value.value));
                    return;
                }
                break;
            case SystemCallOperation.ToInteger:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof FloatValue) {
                    this.activeValue?.evalStack.push(new IntegerValue(Math.trunc(value.value)));
                    return;
                }
                if (value instanceof CharacterValue) {
                    this.activeValue?.evalStack.push(new IntegerValue(Number.parseInt(value.value)));
                    return;
                }
                break;
            case SystemCallOperation.ToReal:
                value = SyscallInterpreter.toValue(value);
                if (value instanceof IntegerValue) {
                    this.activeValue?.evalStack.push(new FloatValue(value.value));
                    return;
                }
                break;
        }
        throw new Error(`Failed system call '${SystemCallOperation[op]}' and one argument. Operation not supported.`);
    }

    private handleDoubleArg(op: SystemCallOperation, value: StackValue, value2: StackValue): void {
        switch (op) {
            case SystemCallOperation.Assert:
                value = SyscallInterpreter.toValue(value);
                value2 = SyscallInterpreter.toValue(value2);
                if (value2 instanceof BooleanValue && value instanceof IntegerValue) {
                    if (!value2.value) {
                        // ignore param n
                        throw new Error(`Assertion failed. Code ${value}.`);
                        //Runtime.instance().haltProcessWithCode(this.processId, value.value);
                        //return;
                    }
                }
                break;
            case SystemCallOperation.Inc:
                value = SyscallInterpreter.toValue(value);
                if (value2 instanceof VariableValue) {
                    const currentValue = value2.value;
                    if (currentValue instanceof IntegerValue && value instanceof IntegerValue) {
                        value2.value = new IntegerValue(currentValue.value + value.value);
                        return;
                    }
                }
                break;
            case SystemCallOperation.Dec:
                value = SyscallInterpreter.toValue(value);
                if (value2 instanceof VariableValue) {
                    const currentValue = value2.value;
                    if (currentValue instanceof IntegerValue && value instanceof IntegerValue) {
                        value2.value = new IntegerValue(currentValue.value - value.value);
                        return;
                    }
                }
                break;
            case SystemCallOperation.Random:
                value = SyscallInterpreter.toValue(value);
                value2 = SyscallInterpreter.toValue(value2);
                if (value2 instanceof IntegerValue && value instanceof IntegerValue) {
                    this.activeValue?.evalStack.push(
                        new IntegerValue(Math.trunc(Math.random() * value.value) + value2.value),
                    );
                }
                break;
        }
        throw new Error(`Failed system call '${SystemCallOperation[op]}' and two arguments. Operation not supported.`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private handleForEachCall(_args: Array<StackValue>): Optional<StackValue> {
        // TODO
        throw new Error('Runtime: Foreach not yet supported.');
        //return undefined;
    }

    handle(value: ActiveValue, call: SystemCallDescriptor): void {
        if (call.arguments.length !== 1) {
            throw new Error(
                'SystemCall requires the number of arguments to be passed. Something must have failed during code gen.',
            );
        }
        if (!(call.arguments[0] instanceof IntegerDescriptor)) {
            throw new Error(
                'SystemCall expects to be passed an IntegerDescriptor argument. Something must have failed during code gen.',
            );
        }
        this.activeValue = value;
        const op = call.systemCall;
        const args = new Array<StackValue>();
        for (let i = 0; i < call.arguments[0].initialValue; ++i) {
            args.push(this.activeValue.evalStack.pop());
        }
        if (op === SystemCallOperation.LoadForEachDesignators) {
            this.handleForEachCall(args);
            this.activeValue = undefined;
            return;
        }
        switch (args.length) {
            case 0:
                this.handleNoArg(op);
                break;
            case 1:
                this.handleSingleArg(op, args[0]);
                break;
            case 2:
                this.handleDoubleArg(op, args[0], args[1]);
                break;
            default:
                throw new Error(`Failed system call '${op}' with ${args.length} arguments. Operation not supported.`);
        }
        this.activeValue = undefined;
    }
}
