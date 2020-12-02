import { ComponentDescriptor, MessageDescriptor, SystemCallOperator } from '@composita/il';
import { Optional } from '@composita/ts-utility-types';
import { StackValue } from './evalstack';
import { Interpreter } from './interpreter';
import {
    TextValue,
    CharacterValue,
    FloatValue,
    BooleanValue,
    VariableValue,
    IntegerValue,
    ActiveValue,
    ServiceValue,
    MessageValue,
    ComponentValue,
} from './values';

export interface SystemHandle {
    print(...msgs: Array<string>): void;
    time(): number;
    createComponent(type: ComponentDescriptor, container: Optional<ActiveValue>): ComponentValue;
    register(active: ActiveValue): void;
    connect(client: ServiceValue, server: ServiceValue): BidirectionalConnection;
    disconnect(client: ServiceValue): void;
}

export class BidirectionalConnection {
    constructor(public readonly client: ServiceValue, public readonly server: ServiceValue) {}
    private readonly clientToServer = new Array<MessageValue>();
    private readonly serverToClient = new Array<MessageValue>();
    sendToClient(message: MessageValue): void {
        this.serverToClient.push(message);
    }
    sendToServer(message: MessageValue): void {
        this.clientToServer.push(message);
    }
    checkClientReceive(message: MessageDescriptor): boolean {
        return this.serverToClient.length > 0 && this.serverToClient[0].descriptor === message;
    }
    checkServerReceive(message: MessageDescriptor): boolean {
        return this.clientToServer.length > 0 && this.clientToServer[0].descriptor === message;
    }
}

export class SyscallInterpreter {
    constructor(private readonly system: SystemHandle) {}

    private handleNoArg(op: SystemCallOperator): Optional<StackValue> {
        switch (op) {
            case SystemCallOperator.WriteLine:
                this.system.print('\n');
                return undefined;
        }
        throw new Error(`Failed system call '${SystemCallOperator[op]}' and zero argumentss. Operation not supported.`);
    }

    private handleSingleArg(op: SystemCallOperator, value: StackValue): Optional<StackValue> {
        switch (op) {
            case SystemCallOperator.Write:
                value = Interpreter.tryLoadVariableValue(value);
                if (
                    value instanceof TextValue ||
                    value instanceof CharacterValue ||
                    value instanceof FloatValue ||
                    value instanceof IntegerValue
                ) {
                    this.system.print(value.value.toString());
                    return undefined;
                }
                break;
            case SystemCallOperator.WriteHex:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof IntegerValue) {
                    this.system.print(value.value.toString(16));
                    return undefined;
                }
                break;
            case SystemCallOperator.Assert:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof BooleanValue) {
                    if (!value.value) {
                        throw new Error('Assertion failed.');
                    }
                    return undefined;
                }
                break;
            case SystemCallOperator.Halt:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof IntegerValue) {
                    throw new Error(`Halt called. Id: ${value.value}`);
                }
                break;
            case SystemCallOperator.Inc:
                if (value instanceof VariableValue) {
                    const currentValue = value.value;
                    if (currentValue instanceof IntegerValue) {
                        value.value = new IntegerValue(currentValue.value + 1);
                        return undefined;
                    }
                }
                break;
            case SystemCallOperator.Dec:
                if (value instanceof VariableValue) {
                    const currentValue = value.value;
                    if (currentValue instanceof IntegerValue) {
                        value.value = new IntegerValue(currentValue.value - 1);
                        return undefined;
                    }
                }
                break;
            case SystemCallOperator.Passivate:
                // TODO
                return undefined;
            case SystemCallOperator.Count:
                // TODO: not supported yet, defaulting to 1
                return undefined;
            case SystemCallOperator.Length:
                if (value instanceof TextValue) {
                    return new IntegerValue(value.value.length);
                }
                break;
            case SystemCallOperator.Sqrt:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof FloatValue) {
                    return new FloatValue(Math.sqrt(value.value));
                }
                break;
            case SystemCallOperator.Sin:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof FloatValue) {
                    return new FloatValue(Math.sin(value.value));
                }
                break;
            case SystemCallOperator.Cos:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof FloatValue) {
                    return new FloatValue(Math.cos(value.value));
                }
                break;
            case SystemCallOperator.Tan:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof FloatValue) {
                    return new FloatValue(Math.tan(value.value));
                }
                break;
            case SystemCallOperator.ArcSin:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof FloatValue) {
                    return new FloatValue(Math.asin(value.value));
                }
                break;
            case SystemCallOperator.ArcCos:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof FloatValue) {
                    return new FloatValue(Math.acos(value.value));
                }
                break;
            case SystemCallOperator.ArcTan:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof FloatValue) {
                    return new FloatValue(Math.atan(value.value));
                }
                break;
            case SystemCallOperator.Min:
                // TODO
                return new FloatValue(Number.MIN_VALUE);
            case SystemCallOperator.Max:
                // TODO
                return new FloatValue(Number.MAX_VALUE);
            case SystemCallOperator.ToCharacter:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof IntegerValue) {
                    return new CharacterValue(String.fromCharCode(value.value));
                }
                break;
            case SystemCallOperator.ToText:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof CharacterValue) {
                    return new TextValue(value.value);
                }
                break;
            case SystemCallOperator.ToInteger:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof FloatValue) {
                    return new IntegerValue(Math.trunc(value.value));
                }
                break;
            case SystemCallOperator.ToReal:
                value = Interpreter.tryLoadVariableValue(value);
                if (value instanceof IntegerValue) {
                    return new FloatValue(value.value);
                }
                break;
        }
        throw new Error(`Failed system call '${SystemCallOperator[op]}' and one argument. Operation not supported.`);
    }

    private handleDoubleArg(op: SystemCallOperator, value: StackValue, value2: StackValue): Optional<StackValue> {
        switch (op) {
            case SystemCallOperator.Assert:
                value = Interpreter.tryLoadVariableValue(value);
                value2 = Interpreter.tryLoadVariableValue(value2);
                if (value2 instanceof BooleanValue && value instanceof IntegerValue) {
                    if (!value2.value) {
                        // ignore param n
                        throw new Error(`Assertion failed. Code ${value}.`);
                        //this.system.haltProcessWithCode(this.processId, value.value);
                        //return;
                    }
                }
                break;
            case SystemCallOperator.Inc:
                value = Interpreter.tryLoadVariableValue(value);
                if (value2 instanceof VariableValue) {
                    const currentValue = value2.value;
                    if (currentValue instanceof IntegerValue && value instanceof IntegerValue) {
                        value2.value = new IntegerValue(currentValue.value + value.value);
                        return;
                    }
                }
                break;
            case SystemCallOperator.Dec:
                value = Interpreter.tryLoadVariableValue(value);
                if (value2 instanceof VariableValue) {
                    const currentValue = value2.value;
                    if (currentValue instanceof IntegerValue && value instanceof IntegerValue) {
                        value2.value = new IntegerValue(currentValue.value - value.value);
                        return;
                    }
                }
                break;
            case SystemCallOperator.Random:
                value = Interpreter.tryLoadVariableValue(value);
                value2 = Interpreter.tryLoadVariableValue(value2);
                if (value2 instanceof IntegerValue && value instanceof IntegerValue) {
                    return new IntegerValue(Math.trunc(Math.random() * value.value) + value2.value);
                }
                break;
        }
        throw new Error(`Failed system call '${SystemCallOperator[op]}' and two arguments. Operation not supported.`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private handleForEachCall(_args: Array<StackValue>): Optional<StackValue> {
        // TODO
        throw new Error('Runtime: Foreach not yet supported.');
        //return undefined;
    }

    handle(op: SystemCallOperator, args: Array<StackValue>): Optional<StackValue> {
        if (op === SystemCallOperator.LoadForEachDesignators) {
            return this.handleForEachCall(args);
        }
        switch (args.length) {
            case 0:
                return this.handleNoArg(op);
            case 1:
                return this.handleSingleArg(op, args[0]);
            case 2:
                return this.handleDoubleArg(op, args[0], args[1]);
            default:
                throw new Error(`Failed system call '${op}' with ${args.length} arguments. Operation not supported.`);
        }
    }
}
