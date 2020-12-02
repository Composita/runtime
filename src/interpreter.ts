import {
    BooleanDescriptor,
    BuiltInTypeDescriptor,
    CharacterDescriptor,
    ComponentDescriptor,
    FloatDescriptor,
    InstructionArgument,
    IntegerDescriptor,
    InterfaceDescriptor,
    JumpDescriptor,
    MessageDescriptor,
    OperatorCode,
    ProcedureDescriptor,
    SystemCallDescriptor,
    TextDescriptor,
    VariableDescriptor,
} from '@composita/il';
import { EvaluationStack, StackValue } from './evalstack';
import { SyscallInterpreter, SystemHandle } from './syscallhandler';
import {
    ActiveValue,
    ArrayVariableValue,
    BooleanValue,
    BuiltInValue,
    CharacterValue,
    ComponentValue,
    FloatValue,
    IntegerValue,
    ServiceValue,
    TextValue,
    VariableValue,
} from './values';

export class Interpreter {
    constructor(private readonly system: SystemHandle, private readonly container: ActiveValue) {}

    private evalStack: EvaluationStack = new EvaluationStack();
    private systemCallHandler = new SyscallInterpreter(this.system);

    isDone(): boolean {
        return this.container.isDone();
    }

    static tryLoadVariableValue(value: StackValue): StackValue {
        return value instanceof VariableValue ? value.value : value;
    }

    private static isBuiltInTypeDescriptor(descriptor: InstructionArgument): descriptor is BuiltInTypeDescriptor {
        return (
            descriptor instanceof IntegerDescriptor ||
            descriptor instanceof FloatDescriptor ||
            descriptor instanceof TextDescriptor ||
            descriptor instanceof CharacterDescriptor ||
            descriptor instanceof BooleanDescriptor
        );
    }

    private static isBuiltInValue(value: StackValue): value is BuiltInValue {
        return (
            value instanceof IntegerValue ||
            value instanceof FloatValue ||
            value instanceof TextValue ||
            value instanceof CharacterValue ||
            value instanceof BooleanValue
        );
    }

    private add(): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof TextValue && left instanceof TextValue) {
            this.evalStack.push(new TextValue(left.value + right.value));
            return;
        }
        if (right instanceof FloatValue && left instanceof FloatValue) {
            this.evalStack.push(new FloatValue(left.value + right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            this.evalStack.push(new IntegerValue(Math.trunc(left.value + right.value)));
            return;
        }
        throw new Error(`Add operation failed.`);
    }

    private sub(): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof FloatValue && left instanceof FloatValue) {
            this.evalStack.push(new FloatValue(left.value - right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            this.evalStack.push(new IntegerValue(Math.trunc(left.value - right.value)));
            return;
        }
        throw new Error(`Sub operation failed.`);
    }

    private mul(): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof FloatValue && left instanceof FloatValue) {
            this.evalStack.push(new FloatValue(left.value * right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            this.evalStack.push(new IntegerValue(Math.trunc(left.value * right.value)));
            return;
        }
        throw new Error(`Mul operation failed.`);
    }

    private div(): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof FloatValue && left instanceof FloatValue) {
            this.evalStack.push(new FloatValue(left.value / right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            this.evalStack.push(new IntegerValue(Math.trunc(left.value / right.value)));
            return;
        }
        throw new Error(`Div operation failed.`);
    }

    private negate(): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof FloatValue) {
            this.evalStack.push(new FloatValue(-right.value));
            return;
        }
        if (right instanceof IntegerValue) {
            this.evalStack.push(new IntegerValue(-right.value));
            return;
        }
        throw new Error(`Negate operation failed.`);
    }

    private mod(): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof FloatValue && left instanceof FloatValue) {
            this.evalStack.push(new FloatValue(left.value % right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            this.evalStack.push(new IntegerValue(Math.trunc(left.value % right.value)));
            return;
        }
        throw new Error(`Mod operation failed.`);
    }

    private handleComparable(
        left: StackValue,
        right: StackValue,
        fn: (left: number | string, right: number | string) => boolean,
    ): void {
        left = Interpreter.tryLoadVariableValue(left) ?? left;
        right = Interpreter.tryLoadVariableValue(right) ?? right;
        if (left instanceof IntegerValue && right instanceof IntegerValue) {
            this.evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof FloatValue && right instanceof FloatValue) {
            this.evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof TextValue && right instanceof TextValue) {
            this.evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof CharacterValue && right instanceof CharacterValue) {
            this.evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        throw new Error(`Unsupported less/greater comparison.`);
    }

    private handleEquatable(
        left: StackValue,
        right: StackValue,
        fn: (left: number | boolean | string, right: number | boolean | string) => boolean,
    ): void {
        left = Interpreter.tryLoadVariableValue(left) ?? left;
        right = Interpreter.tryLoadVariableValue(right) ?? right;
        if (left instanceof BooleanValue && right instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof IntegerValue && right instanceof IntegerValue) {
            this.evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof FloatValue && right instanceof FloatValue) {
            this.evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof TextValue && right instanceof TextValue) {
            this.evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof CharacterValue && right instanceof CharacterValue) {
            this.evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        throw new Error(`Unsupported equality comparison.`);
    }

    private handleCompareOp(op: OperatorCode): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right === undefined) {
            throw new Error(`Unknown right compare argument.`);
        }
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (left === undefined) {
            throw new Error(`Unknown left compare argument.`);
        }
        switch (op) {
            case OperatorCode.Equal:
                this.handleEquatable(left, right, (l, r) => l === r);
                return;
            case OperatorCode.NotEqual:
                this.handleEquatable(left, right, (l, r) => l !== r);
                return;
            case OperatorCode.Less:
                this.handleComparable(left, right, (l, r) => l < r);
                return;
            case OperatorCode.LessEqual:
                this.handleComparable(left, right, (l, r) => l <= r);
                return;
            case OperatorCode.Greater:
                this.handleComparable(left, right, (l, r) => l > r);
                return;
            case OperatorCode.GreaterEqual:
                this.handleComparable(left, right, (l, r) => l >= r);
                return;
        }
        throw new Error(`Unsupprted compare op.`);
    }

    private not(): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(!right.value));
            return;
        }
        throw new Error(`Not operation failed.`);
    }

    private or(): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof BooleanValue && left instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(left.value || right.value));
            return;
        }
        throw new Error(`Or operation failed.`);
    }

    private and(): void {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof BooleanValue && left instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(left.value && right.value));
            return;
        }
        throw new Error(`And operation failed.`);
    }

    private handleNewVariable(target: VariableValue, type: ComponentDescriptor | BuiltInTypeDescriptor): void {
        if (!target.mutable) {
            throw new Error('Cannot NEW instanciate a constant value.');
        }
        if (type instanceof ComponentDescriptor) {
            if (target.value instanceof ComponentValue) {
                target.value.finalize();
            }
            const component = this.system.createComponent(type, this.container);
            target.value = component;
            this.system.register(component);
            return;
        }

        if (type instanceof TextDescriptor) {
            target.value = new TextValue('');
            return;
        }

        throw new Error('NEW built in variable not yet supported.');
    }

    private handleNewArrayVariable(
        target: ArrayVariableValue,
        type: ComponentDescriptor | BuiltInTypeDescriptor,
    ): void {
        const index = new Array<StackValue>();
        target.descriptor.indexTypes.forEach(() => index.push(Interpreter.tryLoadVariableValue(this.evalStack.pop())));
        const entry = new VariableValue(target.descriptor, undefined, false);
        this.handleNewVariable(entry, type);
        target.value.set(index, entry);
    }

    private handleNew(operands: Array<InstructionArgument>): void {
        const type = operands[0];
        if (
            operands.length !== 1 ||
            !(type instanceof ComponentDescriptor || Interpreter.isBuiltInTypeDescriptor(type))
        ) {
            throw new Error('Unsupported NEW call, check your code generator.');
        }
        const target = this.evalStack.pop();

        if (target instanceof VariableValue) {
            this.handleNewVariable(target, type);
            return;
        }

        if (target instanceof ArrayVariableValue) {
            this.handleNewArrayVariable(target, type);
            return;
        }

        throw new Error('Unsupported NEW. NEW target must be a variable.');
    }

    private handleDelete(): void {
        const target = this.evalStack.pop();
        if (!(target instanceof VariableValue || target instanceof ArrayVariableValue)) {
            throw new Error('Only variables can be deleted.');
        }

        if (target instanceof VariableValue) {
            if (target.value instanceof ComponentValue) {
                target.value.finalize();
                return;
            }
            target.value = undefined;
            return;
        }
        const index = new Array<StackValue>();
        target.descriptor.indexTypes.forEach(() => index.push(Interpreter.tryLoadVariableValue(this.evalStack.pop())));
        const toDelete = target.value.get(index);
        if (toDelete instanceof ComponentValue) {
            toDelete.finalize();
            return;
        }
        target.value.delete(index);
    }

    private handleClientSend(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
        const service = this.evalStack.pop();
        if (!(service instanceof ServiceValue)) {
            throw new Error('Expected target service to send to.');
        }
        // TODO
    }

    private handleClientReceive(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
        // TODO
    }

    private handleServerSend(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private handleServerReceive(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private handleConnect(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private handleDisconnect(): void {
        const target = this.evalStack.pop();
        if (!(target instanceof ServiceValue)) {
            throw new Error('Cannot disconnect unknown service.');
        }
        if (this.container instanceof ComponentValue) {
            this.container.disconnect(target);
        }
        // TODO anything else?
    }

    private handleClientReceiveCheck(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private handleServerReceiveCheck(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private handleSystemCall(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof SystemCallDescriptor)) {
            throw new Error('Invalid system call.');
        }
        const call = operands[0];
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
        const stackArgs = new Array<StackValue>();
        for (let i = 0; i < call.arguments[0].initialValue; ++i) {
            stackArgs.push(this.evalStack.pop());
        }
        const returnValue = this.systemCallHandler.handle(call.systemCall, stackArgs);
        if (returnValue !== undefined) {
            this.evalStack.push(returnValue);
        }
    }

    private handleProcedurecall(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof ProcedureDescriptor)) {
            throw new Error('Invalid procedure call.');
        }
        // TODO should we support out variables?
        const args = new Array<ComponentValue | BuiltInValue>();
        operands[0].parameters.forEach(() => {
            const value = Interpreter.tryLoadVariableValue(this.evalStack.pop());
            if (value instanceof ComponentValue || Interpreter.isBuiltInValue(value)) {
                args.push(value);
                return;
            }
            throw new Error('Failed to pass value to procedure.');
        });
        this.container.call(operands[0], args);
    }

    private handleReturn(): void {
        this.container.procedureReturned();
    }

    private loadBoolean(operands: Array<InstructionArgument>): void {
        if (operands.length > 0 && operands[0] instanceof BooleanDescriptor) {
            this.evalStack.push(new BooleanValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Boolean load operation failed.`);
    }

    private loadText(operands: Array<InstructionArgument>): void {
        if (operands.length >= 1 && operands[0] instanceof TextDescriptor) {
            this.evalStack.push(new TextValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Text load operation failed.`);
    }

    private loadCharacter(operands: Array<InstructionArgument>): void {
        if (operands.length >= 1 && operands[0] instanceof CharacterDescriptor) {
            this.evalStack.push(new CharacterValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Character load operation failed.`);
    }

    private loadFloat(operands: Array<InstructionArgument>): void {
        if (operands.length > 0 && operands[0] instanceof FloatDescriptor) {
            this.evalStack.push(new FloatValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Float load operation failed.`);
    }

    private loadInteger(operands: Array<InstructionArgument>): void {
        if (operands.length > 0 && operands[0] instanceof IntegerDescriptor) {
            this.evalStack.push(new IntegerValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Integer load operation failed.`);
    }

    private storeVariable(): void {
        const value = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const variable = this.evalStack.pop();
        if (variable instanceof VariableValue) {
            const varValue = variable.value;
            if (varValue === undefined && (Interpreter.isBuiltInValue(value) || value instanceof ComponentValue)) {
                variable.value = value;
                return;
            }
            if (
                (value instanceof IntegerValue && varValue instanceof IntegerValue) ||
                (value instanceof FloatValue && varValue instanceof FloatValue) ||
                (value instanceof BooleanValue && varValue instanceof BooleanValue) ||
                (value instanceof CharacterValue && varValue instanceof CharacterValue) ||
                (value instanceof TextValue && varValue instanceof TextValue) ||
                (value instanceof ComponentValue && varValue instanceof ComponentValue)
            ) {
                variable.value = value;
                return;
            }
        }
        throw new Error(`Unsupported Variable Store.`);
    }

    private loadVariable(operands: Array<InstructionArgument>): void {
        if (operands.length === 1 && operands[0] instanceof VariableDescriptor) {
            const variable = this.container.variables.find((variable) => variable.descriptor === operands[0]);
            if (variable === undefined) {
                throw new Error('Unknown variable.');
            }
            this.evalStack.push(variable);
            return;
        }
        throw new Error(`Unsupported Variable Load.`);
    }

    private loadService(operands: Array<InstructionArgument>): void {
        if (operands.length === 1 && operands[0] instanceof InterfaceDescriptor) {
            const service = this.container.findService(operands[0]);
            if (service === undefined) {
                throw new Error('Unknown service.');
            }
            this.evalStack.push(service);
            return;
        }
        throw new Error(`Unsupported Variable Load.`);
    }

    private branch(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1) {
            console.log(operands);
            throw new Error(`Branch conditions must have one operand.`);
        }
        const operand = operands[0];
        if (operand instanceof JumpDescriptor) {
            this.container.jump(operand);
            return;
        }
        throw new Error(`Failed jump.`);
    }

    private branchConditionally(branch: boolean, operands: Array<InstructionArgument>): void {
        const condition = this.evalStack.pop();
        if (operands.length !== 1) {
            throw new Error(`Branch conditions only have one operand.`);
        }
        if (condition instanceof BooleanValue && operands[0] instanceof JumpDescriptor) {
            if (condition.value === branch) {
                this.branch(operands);
                return;
            }
            return;
        }
        throw new Error(`Conditional jump failed.`);
    }

    processNext(): void {
        if (this.container.isDone()) {
            return;
        }
        const nextInstruction = this.container.fetch();
        if (nextInstruction === undefined) {
            return;
        }
        console.log(OperatorCode[nextInstruction.code]);
        switch (nextInstruction.code) {
            case OperatorCode.Add:
                this.add();
                break;
            case OperatorCode.Subtract:
                this.sub();
                break;
            case OperatorCode.Multiply:
                this.mul();
                break;
            case OperatorCode.Divide:
                this.div();
                break;
            case OperatorCode.Negate:
                this.negate();
                break;
            case OperatorCode.Modulo:
                this.mod();
                break;
            case OperatorCode.Equal:
            case OperatorCode.Less:
            case OperatorCode.LessEqual:
            case OperatorCode.Greater:
            case OperatorCode.GreaterEqual:
            case OperatorCode.NotEqual:
                this.handleCompareOp(nextInstruction.code);
                break;
            case OperatorCode.Not:
                this.not();
                break;
            case OperatorCode.LogicOr:
                this.or();
                break;
            case OperatorCode.LogicAnd:
                this.and();
                break;
            case OperatorCode.New:
                this.handleNew(nextInstruction.arguments);
                break;
            case OperatorCode.Delete:
                this.handleDelete();
                break;
            case OperatorCode.ClientSend:
                this.handleClientSend(nextInstruction.arguments);
                break;
            case OperatorCode.ClientReceive:
                this.handleClientReceive(nextInstruction.arguments);
                break;
            case OperatorCode.ServerSend:
                this.handleServerSend(nextInstruction.arguments);
                break;
            case OperatorCode.ServerReceive:
                this.handleServerReceive(nextInstruction.arguments);
                break;
            case OperatorCode.Connect:
                this.handleConnect(nextInstruction.arguments);
                break;
            case OperatorCode.Disconnect:
                this.handleDisconnect();
                break;
            case OperatorCode.ClientReceiveTest:
                this.handleClientReceiveCheck(nextInstruction.arguments);
                break;
            case OperatorCode.ServerReceiveTest:
                this.handleServerReceiveCheck(nextInstruction.arguments);
                // TODO !!
                break;
            case OperatorCode.ClientInputTest:
                throw new Error('Client side INPUT is not yet supportd.');
            case OperatorCode.ServerInputTest:
                throw new Error('Server side INPUT is not yet supportd.');
            case OperatorCode.SystemCall:
                this.handleSystemCall(nextInstruction.arguments);
                break;
            case OperatorCode.ProcedureCall:
                this.handleProcedurecall(nextInstruction.arguments);
                break;
            case OperatorCode.Return:
                this.handleReturn();
                break;
            case OperatorCode.LoadConstantBoolean:
                this.loadBoolean(nextInstruction.arguments);
                break;
            case OperatorCode.LoadConstantText:
                this.loadText(nextInstruction.arguments);
                break;
            case OperatorCode.LoadConstantCharacter:
                this.loadCharacter(nextInstruction.arguments);
                break;
            case OperatorCode.LoadConstantFloat:
                this.loadFloat(nextInstruction.arguments);
                break;
            case OperatorCode.LoadConstantInteger:
                this.loadInteger(nextInstruction.arguments);
                break;
            case OperatorCode.Move:
                throw new Error('MOVE is not yet supported.');
            case OperatorCode.StoreVariable:
                this.storeVariable();
                break;
            case OperatorCode.LoadVariable:
                this.loadVariable(nextInstruction.arguments);
                break;
            case OperatorCode.LoadService:
                this.loadService(nextInstruction.arguments);
                break;
            case OperatorCode.Await:
                // TODO: Can be ignored for now
                console.warn('AWAIT ignored.');
                break;
            case OperatorCode.AcquireShared:
                // TODO: Can be ignored for now
                console.warn('Acquire SHARED ignored.');
                break;
            case OperatorCode.ReleaseShared:
                // TODO: Can be ignored for now
                console.warn('Release SHARED ignored.');
                break;
            case OperatorCode.AcquireExclusive:
                // TODO: Can be ignored for now
                console.warn('Acquire EXCLUSIVE ignored.');
                break;
            case OperatorCode.ReleaseExclusive:
                // TODO: Can be ignored for now
                console.warn('Release EXCLUSIVE ignored.');
                break;
            case OperatorCode.Branch:
                this.branch(nextInstruction.arguments);
                break;
            case OperatorCode.BranchTrue:
                this.branchConditionally(true, nextInstruction.arguments);
                break;
            case OperatorCode.BranchFalse:
                this.branchConditionally(false, nextInstruction.arguments);
                break;
            case OperatorCode.IsType:
                throw new Error('IS typecheck is not yet supported.');
            case OperatorCode.ExistsTest:
                throw new Error('EXISTSW check is not yet supported.');
        }
    }
}
