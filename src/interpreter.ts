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
    TypeDescriptor,
    VariableDescriptor,
} from '@composita/il';
import { Optional } from '@composita/ts-utility-types';
import { EvaluationStack, StackValue } from './evalstack';
import { Runtime } from './runtime';
import { SyscallInterpreter } from './syscallhandler';
import {
    ActiveValue,
    ArrayVariableValue,
    BooleanValue,
    BuiltInValue,
    CharacterValue,
    ComponentPointer,
    ComponentValue,
    FloatValue,
    IntegerValue,
    MessageValue,
    PointerValue,
    ServicePointer,
    TextValue,
    VariableValue,
} from './values';
import { default as equal } from 'fast-deep-equal';

export class Interpreter {
    constructor(private readonly system: Runtime, private readonly valuePointer: PointerValue) {}

    private evalStack: EvaluationStack = new EvaluationStack();
    private systemCallHandler = new SyscallInterpreter(this.system, this.evalStack);

    isDone(): boolean {
        return this.loadValue().isDone();
    }

    private loadValue(): ActiveValue {
        return this.system.load(this.valuePointer);
    }

    private loadParentValue(current: ActiveValue): Optional<ActiveValue> {
        return this.system.tryLoad(current.parent);
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

    private static descriptorMatchBuiltIn(descriptor: TypeDescriptor, value: StackValue): boolean {
        return (
            (descriptor instanceof IntegerDescriptor && value instanceof IntegerValue) ||
            (descriptor instanceof FloatDescriptor && value instanceof FloatValue) ||
            (descriptor instanceof CharacterDescriptor && value instanceof CharacterValue) ||
            (descriptor instanceof TextDescriptor && value instanceof TextValue) ||
            (descriptor instanceof BooleanDescriptor && value instanceof BooleanValue)
        );
    }

    private add(): void {
        const right = this.evalStack.popVariable();
        const left = this.evalStack.popVariable();
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
        const right = this.evalStack.popVariable();
        const left = this.evalStack.popVariable();
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
        const right = this.evalStack.popVariable();
        const left = this.evalStack.popVariable();
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
        const right = this.evalStack.popVariable();
        const left = this.evalStack.popVariable();
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
        const right = this.evalStack.popVariable();
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
        const right = this.evalStack.popVariable();
        const left = this.evalStack.popVariable();
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
        const right = this.evalStack.popVariable();
        if (right === undefined) {
            throw new Error(`Unknown right compare argument.`);
        }
        const left = this.evalStack.popVariable();
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
        const right = this.evalStack.popVariable();
        if (right instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(!right.value));
            return;
        }
        throw new Error(`Not operation failed.`);
    }

    private or(): void {
        const right = this.evalStack.popVariable();
        const left = this.evalStack.popVariable();
        if (right instanceof BooleanValue && left instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(left.value || right.value));
            return;
        }
        throw new Error(`Or operation failed.`);
    }

    private and(): void {
        const right = this.evalStack.popVariable();
        const left = this.evalStack.popVariable();
        if (right instanceof BooleanValue && left instanceof BooleanValue) {
            this.evalStack.push(new BooleanValue(left.value && right.value));
            return;
        }
        throw new Error(`And operation failed.`);
    }

    private handleNewVariable(target: VariableValue, type: ComponentDescriptor | BuiltInTypeDescriptor): void {
        if (!target.isMutabled()) {
            throw new Error('Cannot NEW instanciate a constant value.');
        }
        if (type instanceof ComponentDescriptor) {
            if (target.value instanceof ComponentValue) {
                target.value.finalize();
            }
            const component = this.system.createComponent(type, this.valuePointer);
            target.value = component;
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
        target.descriptor.indexTypes.forEach(() => index.push(this.evalStack.popVariable()));
        const entry = new VariableValue(target.descriptor, undefined);
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
        target.descriptor.indexTypes.forEach(() => index.push(this.evalStack.popVariable()));
        const toDelete = target.value.get(index);
        if (toDelete instanceof ComponentValue) {
            toDelete.finalize();
            return;
        }
        target.value.delete(index);
    }

    private loadMessage(descriptor: MessageDescriptor): MessageValue {
        const message = new MessageValue(descriptor);
        descriptor.data.forEach((type) => {
            const value = this.evalStack.popVariable();
            if (!Interpreter.isBuiltInValue(value)) {
                throw new Error('Message can only contain built in values: TEXT, CHARACTER INTEGER, REAL, BOOLEAN');
            }
            if (!Interpreter.descriptorMatchBuiltIn(type, value)) {
                throw new Error('Message param does not match stack value');
            }
            message.fields.push(value);
        });
        return message;
    }

    private handleSend(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescriptor required for sending.');
        }
        const service = this.evalStack.pop();
        if (!(service instanceof ServicePointer)) {
            throw new Error('Expected target service to send to.');
        }
        const message = this.loadMessage(operands[0]);
        this.system.send(service, message);
    }

    private wait: Optional<() => boolean> = undefined;

    private handleReceive(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescriptor required for receiving.');
        }
        const descriptor = operands[0];
        const target = this.evalStack.popVariable();
        if (!(target instanceof ServicePointer)) {
            throw new Error('Receiver must be a service.');
        }
        this.wait = () => {
            const message = this.system.receive(target, descriptor);
            if (message === Runtime.finishMessage) {
                return false;
            }
            if (message !== undefined) {
                message.fields.forEach((element) => {
                    this.evalStack.push(element);
                    this.storeVariable();
                });
                return false;
            }
            return true;
        };
        if (!this.wait()) {
            this.wait = undefined;
        }
    }

    private handleConnect(): void {
        const to = this.evalStack.popVariable();
        if (!(to instanceof ComponentPointer)) {
            // TODO: check if service pointer is possible here as well. Keeping it to components for now.
            throw new Error('Connect target needs to be either a component.');
        }
        const service = this.evalStack.pop();
        if (!(service instanceof ServicePointer)) {
            throw new Error('Service required for from.');
        }
        //const from = this.evalStack.popVariable();
        //if (!(from instanceof ComponentPointer)) {
        //    throw new Error('Connect requires a component.');
        //}
        this.system.connect(to, service);
    }

    private handleDisconnect(): void {
        const target = this.evalStack.popVariable();
        if (!(target instanceof ComponentPointer)) {
            throw new Error('Need to know from component.');
        }
        const service = this.evalStack.pop();
        if (!(service instanceof ServicePointer)) {
            throw new Error('Service required for disconnecting.');
        }
        this.system.disconnect(target, service);
        // TODO
    }

    private handleReceiveCheck(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescriptor required for receiving.');
        }
        const descriptor = operands[0];
        const target = this.evalStack.popVariable();
        if (!(target instanceof ServicePointer)) {
            throw new Error('Receiver must be a component or service.');
        }
        this.wait = () => {
            const message = this.system.receiveTest(target);
            if (message === undefined) {
                return true;
            }
            if (equal(message.descriptor, descriptor)) {
                this.evalStack.push(new BooleanValue(true));
                return false;
            }
            this.evalStack.push(new BooleanValue(false));
            return false;
        };
        if (!this.wait()) {
            this.wait = undefined;
        }
    }

    private handleInputCheck(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescriptor required for receiving.');
        }
        const descriptor = operands[0];
        const target = this.evalStack.popVariable();
        if (!(target instanceof ServicePointer)) {
            throw new Error('Receiver must be a component or service.');
        }
        const message = this.system.receiveTest(target);
        if (message !== undefined && equal(message.descriptor, descriptor)) {
            this.evalStack.push(new BooleanValue(true));
            return;
        }
        this.evalStack.push(new BooleanValue(false));
    }

    private handleSystemCall(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof SystemCallDescriptor)) {
            throw new Error('Invalid system call.');
        }
        this.systemCallHandler.handle(operands[0]);
    }

    private handleProcedurecall(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof ProcedureDescriptor)) {
            throw new Error('Invalid procedure call.');
        }
        // TODO should we support out variables?
        const args = new Array<ComponentPointer | BuiltInValue>();
        operands[0].parameters.forEach(() => {
            const value = this.evalStack.popVariable();
            if (value instanceof ComponentPointer || Interpreter.isBuiltInValue(value)) {
                args.push(value);
                return;
            }
            throw new Error('Failed to pass value to procedure.');
        });
        this.loadValue().call(operands[0], args);
    }

    private handleReturn(): void {
        this.loadValue().procedureReturned();
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
        const value = this.evalStack.popVariable();
        const variable = this.evalStack.pop();
        if (variable instanceof VariableValue) {
            if (!variable.isMutabled()) {
                throw new Error('Cannot assign value to a constant.');
            }
            const varValue = variable.value;
            if (varValue === undefined && (Interpreter.isBuiltInValue(value) || value instanceof ComponentPointer)) {
                variable.value = value;
                return;
            }
            if (
                (value instanceof IntegerValue && varValue instanceof IntegerValue) ||
                (value instanceof FloatValue && varValue instanceof FloatValue) ||
                (value instanceof BooleanValue && varValue instanceof BooleanValue) ||
                (value instanceof CharacterValue && varValue instanceof CharacterValue) ||
                (value instanceof TextValue && varValue instanceof TextValue) ||
                (value instanceof ComponentPointer && varValue instanceof ComponentPointer)
            ) {
                variable.value = value;
                return;
            }
        }
        if (variable instanceof ArrayVariableValue) {
            const index = new Array<StackValue>();
            variable.descriptor.indexTypes.forEach(() => index.push(this.evalStack.popVariable()));
            variable.value.set(index, value);
            return;
        }
        throw new Error(`Unsupported Variable Store.`);
    }

    private loadVariable(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1) {
            throw new Error('Expected single argument for variable load only.');
        }
        if (operands[0] instanceof VariableDescriptor) {
            let current = this.loadValue();
            let parent = this.loadParentValue(current);
            let variable = current.variables.find((variable) => variable.descriptor === operands[0]);
            while (variable === undefined && parent !== undefined) {
                current = parent;
                parent = this.loadParentValue(current);
                variable = current.variables.find((variable) => equal(variable.descriptor, operands[0]));
            }
            if (variable instanceof VariableValue) {
                this.evalStack.push(variable);
                return;
            }
            if (variable instanceof ArrayVariableValue) {
                const arrayVariable = this.loadValue().variables.find((loadedVar) =>
                    equal(loadedVar.descriptor, operands[0]),
                );
                if (arrayVariable === undefined) {
                    throw new Error('Unknown array variable.');
                }
                const index = new Array<StackValue>();
                arrayVariable.descriptor.indexTypes.forEach(() => index.push(this.evalStack.popVariable()));
                this.evalStack.push(variable.value.get(index));
                return;
            }
        }
        throw new Error(`Unsupported Variable Load.`);
    }

    private loadService(operands: Array<InstructionArgument>): void {
        if (operands.length === 1 && operands[0] instanceof InterfaceDescriptor) {
            const pointer = this.evalStack.popVariable();
            if (pointer instanceof ComponentPointer) {
                const service = this.system.getService(operands[0], pointer);
                this.evalStack.push(service);
                return;
            }
        }
        throw new Error(`Unsupported Service Load.`);
    }

    private loadThis(): void {
        if (this.valuePointer instanceof ServicePointer || this.valuePointer instanceof ComponentPointer) {
            this.evalStack.push(this.valuePointer);
            return;
        }
        throw new Error('Load this only for services supported.');
    }

    private lock: Optional<number> = undefined;

    private handleAcquireExclusive(): void {
        this.wait = () => {
            const newLock = this.system.acquireExclusive(this.lock);
            if (newLock === undefined) {
                return true;
            }
            this.lock = newLock;
            return false;
        };
        if (!this.wait()) {
            this.wait = undefined;
        }
    }

    private handleReleaseExclusive(): void {
        this.wait = () => {
            const success = this.system.releaseExclusive(this.lock);
            if (success) {
                this.lock = undefined;
            }
            return !success;
        };
        if (!this.wait()) {
            this.wait = undefined;
        }
    }

    private branch(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1) {
            throw new Error(`Branch conditions must have one operand.`);
        }
        const operand = operands[0];
        if (operand instanceof JumpDescriptor) {
            this.loadValue().jump(operand);
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
        if (this.loadValue().isDone()) {
            return;
        }
        if (this.wait !== undefined) {
            if (this.wait()) {
                return;
            }
            this.wait = undefined;
        }
        const nextInstruction = this.loadValue().fetch();
        if (nextInstruction === undefined) {
            return;
        }
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
            case OperatorCode.Send:
                this.handleSend(nextInstruction.arguments);
                break;
            case OperatorCode.Receive:
                this.handleReceive(nextInstruction.arguments);
                break;
            case OperatorCode.Connect:
                this.handleConnect();
                break;
            case OperatorCode.Disconnect:
                this.handleDisconnect();
                break;
            case OperatorCode.ReceiveTest:
                this.handleReceiveCheck(nextInstruction.arguments);
                break;
            case OperatorCode.InputTest:
                this.handleInputCheck(nextInstruction.arguments);
                break;
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
            case OperatorCode.LoadThis:
                this.loadThis();
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
                this.handleAcquireExclusive();
                break;
            case OperatorCode.ReleaseExclusive:
                this.handleReleaseExclusive();
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
