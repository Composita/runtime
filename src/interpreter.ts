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
    ProcedureValue,
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

    private async add(): Promise<void> {
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

    private async sub(): Promise<void> {
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

    private async mul(): Promise<void> {
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

    private async div(): Promise<void> {
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

    private async negate(): Promise<void> {
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

    private async mod(): Promise<void> {
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

    private async handleComparable(
        left: StackValue,
        right: StackValue,
        fn: (left: number | string, right: number | string) => boolean,
    ): Promise<void> {
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

    private async handleEquatable(
        left: StackValue,
        right: StackValue,
        fn: (left: number | boolean | string, right: number | boolean | string) => boolean,
    ): Promise<void> {
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

    private async handleCompareOp(op: OperatorCode): Promise<void> {
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
                await this.handleEquatable(left, right, (l, r) => l === r);
                return;
            case OperatorCode.NotEqual:
                await this.handleEquatable(left, right, (l, r) => l !== r);
                return;
            case OperatorCode.Less:
                await this.handleComparable(left, right, (l, r) => l < r);
                return;
            case OperatorCode.LessEqual:
                await this.handleComparable(left, right, (l, r) => l <= r);
                return;
            case OperatorCode.Greater:
                await this.handleComparable(left, right, (l, r) => l > r);
                return;
            case OperatorCode.GreaterEqual:
                await this.handleComparable(left, right, (l, r) => l >= r);
                return;
        }
        throw new Error(`Unsupprted compare op.`);
    }

    private async not(): Promise<void> {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(!right.value));
            return;
        }
        throw new Error(`Not operation failed.`);
    }

    private async or(): Promise<void> {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof BooleanValue && left instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(left.value || right.value));
            return;
        }
        throw new Error(`Or operation failed.`);
    }

    private async and(): Promise<void> {
        const right = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        const left = Interpreter.tryLoadVariableValue(this.evalStack.pop());
        if (right instanceof BooleanValue && left instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(left.value && right.value));
            return;
        }
        throw new Error(`And operation failed.`);
    }

    private async handleNewVariable(
        target: VariableValue,
        type: ComponentDescriptor | BuiltInTypeDescriptor,
    ): Promise<void> {
        if (!target.mutable) {
            throw new Error('Cannot NEW instanciate a constant value.');
        }
        if (type instanceof ComponentDescriptor) {
            const component = new ComponentValue(type, this.container);
            type.declarations.variables.forEach((descriptor) => {
                if (descriptor.indexTypes.length > 0) {
                    component.variables.push(new ArrayVariableValue(descriptor, new Map()));
                } else {
                    component.variables.push(new VariableValue(descriptor, undefined, descriptor.mutable));
                }
            });
            type.declarations.procedures.forEach((descriptor) =>
                component.procedures.push(new ProcedureValue(descriptor, component)),
            );
            type.implementations.forEach((descriptor) =>
                component.services.push(new ServiceValue(descriptor, component)),
            );
            if (target.value !== undefined && target.value instanceof ComponentValue) {
                target.value.finalize();
                console.log(target.value);
            }
            target.value = this.system.createComponent(type, this.container);
            this.system.register(component);
            return;
        }

        if (type instanceof TextDescriptor) {
            target.value = new TextValue('');
            return;
        }

        throw new Error('NEW built in variable not yet supported.');
    }

    private async handleNewArrayVariable(
        target: ArrayVariableValue,
        type: ComponentDescriptor | BuiltInTypeDescriptor,
    ): Promise<void> {
        const index = new Array<StackValue>();
        target.descriptor.indexTypes.forEach(() => index.push(Interpreter.tryLoadVariableValue(this.evalStack.pop())));
        const entry = new VariableValue(target.descriptor, undefined, false);
        this.handleNewVariable(entry, type);
        target.value.set(index, entry);
    }

    private async handleNew(operands: Array<InstructionArgument>): Promise<void> {
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

    private async handleDelete(): Promise<void> {
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

    private async handleClientSend(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
        const service = this.evalStack.pop();
        if (!(service instanceof ServiceValue)) {
            throw new Error('Expected target service to send to.');
        }
        // TODO
    }

    private async handleClientReceive(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
        // TODO
    }

    private async handleServerSend(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private async handleServerReceive(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private async handleConnect(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private async handleDisconnect(): Promise<void> {
        const target = this.evalStack.pop();
        if (!(target instanceof ServiceValue)) {
            throw new Error('Cannot disconnect unknown service.');
        }
        if (this.container instanceof ComponentValue) {
            this.container.disconnect(target);
        }
        // TODO anything else?
    }

    private async handleClientReceiveCheck(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private async handleServerReceiveCheck(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescritpr required for sending.');
        }
    }

    private async handleSystemCall(operands: Array<InstructionArgument>): Promise<void> {
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
        const returnValue = await this.systemCallHandler.handle(call.systemCall, stackArgs);
        if (returnValue !== undefined) {
            this.evalStack.push(returnValue);
        }
    }

    private async handleProcedurecall(operands: Array<InstructionArgument>): Promise<void> {
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

    private async handleReturn(): Promise<void> {
        this.container.procedureReturned();
    }

    private async loadBoolean(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length > 0 && operands[0] instanceof BooleanDescriptor) {
            this.evalStack.push(new BooleanValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Boolean load operation failed.`);
    }

    private async loadText(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length >= 1 && operands[0] instanceof TextDescriptor) {
            this.evalStack.push(new TextValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Text load operation failed.`);
    }

    private async loadCharacter(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length >= 1 && operands[0] instanceof CharacterDescriptor) {
            this.evalStack.push(new CharacterValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Character load operation failed.`);
    }

    private async loadFloat(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length > 0 && operands[0] instanceof FloatDescriptor) {
            this.evalStack.push(new FloatValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Float load operation failed.`);
    }

    private async loadInteger(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length > 0 && operands[0] instanceof IntegerDescriptor) {
            this.evalStack.push(new IntegerValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Integer load operation failed.`);
    }

    private async storeVariable(): Promise<void> {
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

    private async branch(operands: Array<InstructionArgument>): Promise<void> {
        if (operands.length !== 1) {
            throw new Error(`Branch conditions only have one operand.`);
        }
        const operand = operands[0];
        if (operand instanceof JumpDescriptor) {
            this.container.jump(operand);
            return;
        }
        throw new Error(`Failed jump.`);
    }

    private async branchConditionally(branch: boolean, operands: Array<InstructionArgument>): Promise<void> {
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

    async processNext(): Promise<void> {
        const nextInstruction = this.container.fetch();
        if (nextInstruction === undefined) {
            return;
        }
        //console.log(OperatorCode[nextInstruction.code]);
        switch (nextInstruction.code) {
            case OperatorCode.Add:
                await this.add();
                break;
            case OperatorCode.Subtract:
                await this.sub();
                break;
            case OperatorCode.Multiply:
                await this.mul();
                break;
            case OperatorCode.Divide:
                await this.div();
                break;
            case OperatorCode.Negate:
                await this.negate();
                break;
            case OperatorCode.Modulo:
                await this.mod();
                break;
            case OperatorCode.Equal:
            case OperatorCode.Less:
            case OperatorCode.LessEqual:
            case OperatorCode.Greater:
            case OperatorCode.GreaterEqual:
            case OperatorCode.NotEqual:
                await this.handleCompareOp(nextInstruction.code);
                break;
            case OperatorCode.Not:
                await this.not();
                break;
            case OperatorCode.LogicOr:
                await this.or();
                break;
            case OperatorCode.LogicAnd:
                await this.and();
                break;
            case OperatorCode.New:
                await this.handleNew(nextInstruction.arguments);
                break;
            case OperatorCode.Delete:
                this.handleDelete();
                break;
            case OperatorCode.ClientSend:
                await this.handleClientSend(nextInstruction.arguments);
                break;
            case OperatorCode.ClientReceive:
                await this.handleClientReceive(nextInstruction.arguments);
                break;
            case OperatorCode.ServerSend:
                await this.handleServerSend(nextInstruction.arguments);
                break;
            case OperatorCode.ServerReceive:
                await this.handleServerReceive(nextInstruction.arguments);
                break;
            case OperatorCode.Connect:
                await this.handleConnect(nextInstruction.arguments);
                break;
            case OperatorCode.Disconnect:
                await this.handleDisconnect();
                break;
            case OperatorCode.ClientReceiveTest:
                await this.handleClientReceiveCheck(nextInstruction.arguments);
                break;
            case OperatorCode.ServerReceiveTest:
                await this.handleServerReceiveCheck(nextInstruction.arguments);
                // TODO !!
                break;
            case OperatorCode.ClientInputTest:
                throw new Error('Client side INPUT is not yet supportd.');
            case OperatorCode.ServerInputTest:
                throw new Error('Server side INPUT is not yet supportd.');
            case OperatorCode.SystemCall:
                await this.handleSystemCall(nextInstruction.arguments);
                break;
            case OperatorCode.ProcedureCall:
                await this.handleProcedurecall(nextInstruction.arguments);
                break;
            case OperatorCode.Return:
                await this.handleReturn();
                break;
            case OperatorCode.LoadConstantBoolean:
                await this.loadBoolean(nextInstruction.arguments);
                break;
            case OperatorCode.LoadConstantText:
                await this.loadText(nextInstruction.arguments);
                break;
            case OperatorCode.LoadConstantCharacter:
                await this.loadCharacter(nextInstruction.arguments);
                break;
            case OperatorCode.LoadConstantFloat:
                await this.loadFloat(nextInstruction.arguments);
                break;
            case OperatorCode.LoadConstantInteger:
                await this.loadInteger(nextInstruction.arguments);
                break;
            case OperatorCode.Move:
                throw new Error('MOVE is not yet supported.');
            case OperatorCode.StoreVariable:
                await this.storeVariable();
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
                await this.branch(nextInstruction.arguments);
                break;
            case OperatorCode.BranchTrue:
                await this.branchConditionally(true, nextInstruction.arguments);
                break;
            case OperatorCode.BranchFalse:
                await this.branchConditionally(false, nextInstruction.arguments);
                break;
            case OperatorCode.IsType:
                throw new Error('IS typecheck is not yet supported.');
            case OperatorCode.ExistsTest:
                throw new Error('EXISTSW check is not yet supported.');
        }
    }
}
