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
    OperationCode,
    ProcedureDescriptor,
    SystemCallDescriptor,
    TextDescriptor,
    TypeDescriptor,
    VariableDescriptor,
} from '@composita/il';
import { getOrThrow, Optional } from '@composita/ts-utility-types';
import { Runtime } from './runtime';
import { SyscallInterpreter } from './syscallhandler';
import {
    ActiveValue,
    ArrayIndexValue,
    ArrayVariableValue,
    BooleanValue,
    BuiltInValue,
    CharacterValue,
    ComponentPointer,
    ComponentValue,
    FloatValue,
    IndexTypes,
    IntegerValue,
    MessageValue,
    PointerValue,
    ServicePointer,
    StackValue,
    TextValue,
    UndefinedValue,
    VariableValue,
} from './values';
import { default as equal } from 'fast-deep-equal';

export class Interpreter {
    private systemCallHandler = new SyscallInterpreter();
    private activeValue: Optional<ActiveValue> = undefined;

    private loadValue(pointer: PointerValue): void {
        this.activeValue = Runtime.instance().load(pointer);
    }

    private unloadValue(): void {
        this.activeValue = undefined;
    }

    private loadParentValue(current: ActiveValue): Optional<ActiveValue> {
        return Runtime.instance().tryLoad(current.parent);
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
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        const left = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right instanceof TextValue && left instanceof TextValue) {
            getOrThrow(this.activeValue).evalStack.push(new TextValue(left.value + right.value));
            return;
        }
        if (right instanceof FloatValue && left instanceof FloatValue) {
            getOrThrow(this.activeValue).evalStack.push(new FloatValue(left.value + right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            getOrThrow(this.activeValue).evalStack.push(new IntegerValue(Math.trunc(left.value + right.value)));
            return;
        }
        throw new Error(`Add operation failed.`);
    }

    private sub(): void {
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        const left = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right instanceof FloatValue && left instanceof FloatValue) {
            getOrThrow(this.activeValue).evalStack.push(new FloatValue(left.value - right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            getOrThrow(this.activeValue).evalStack.push(new IntegerValue(Math.trunc(left.value - right.value)));
            return;
        }
        throw new Error(`Sub operation failed.`);
    }

    private mul(): void {
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        const left = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right instanceof FloatValue && left instanceof FloatValue) {
            getOrThrow(this.activeValue).evalStack.push(new FloatValue(left.value * right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            getOrThrow(this.activeValue).evalStack.push(new IntegerValue(Math.trunc(left.value * right.value)));
            return;
        }
        throw new Error(`Mul operation failed.`);
    }

    private div(): void {
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        const left = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right instanceof FloatValue && left instanceof FloatValue) {
            getOrThrow(this.activeValue).evalStack.push(new FloatValue(left.value / right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            getOrThrow(this.activeValue).evalStack.push(new IntegerValue(Math.trunc(left.value / right.value)));
            return;
        }
        throw new Error(`Div operation failed.`);
    }

    private negate(): void {
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right instanceof FloatValue) {
            getOrThrow(this.activeValue).evalStack.push(new FloatValue(-right.value));
            return;
        }
        if (right instanceof IntegerValue) {
            getOrThrow(this.activeValue).evalStack.push(new IntegerValue(-right.value));
            return;
        }
        throw new Error(`Negate operation failed.`);
    }

    private mod(): void {
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        const left = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right instanceof FloatValue && left instanceof FloatValue) {
            getOrThrow(this.activeValue).evalStack.push(new FloatValue(left.value % right.value));
            return;
        }
        if (right instanceof IntegerValue && left instanceof IntegerValue) {
            getOrThrow(this.activeValue).evalStack.push(new IntegerValue(Math.trunc(left.value % right.value)));
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
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof FloatValue && right instanceof FloatValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof TextValue && right instanceof TextValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof CharacterValue && right instanceof CharacterValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(fn(left.value, right.value)));
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
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof IntegerValue && right instanceof IntegerValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof FloatValue && right instanceof FloatValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof TextValue && right instanceof TextValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        if (left instanceof CharacterValue && right instanceof CharacterValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(fn(left.value, right.value)));
            return;
        }
        throw new Error(`Unsupported equality comparison.`);
    }

    private handleCompareOp(op: OperationCode): void {
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right === undefined) {
            throw new Error(`Unknown right compare argument.`);
        }
        const left = getOrThrow(this.activeValue).evalStack.popVariable();
        if (left === undefined) {
            throw new Error(`Unknown left compare argument.`);
        }
        switch (op) {
            case OperationCode.Equal:
                this.handleEquatable(left, right, (l, r) => l === r);
                return;
            case OperationCode.NotEqual:
                this.handleEquatable(left, right, (l, r) => l !== r);
                return;
            case OperationCode.Less:
                this.handleComparable(left, right, (l, r) => l < r);
                return;
            case OperationCode.LessEqual:
                this.handleComparable(left, right, (l, r) => l <= r);
                return;
            case OperationCode.Greater:
                this.handleComparable(left, right, (l, r) => l > r);
                return;
            case OperationCode.GreaterEqual:
                this.handleComparable(left, right, (l, r) => l >= r);
                return;
        }
        throw new Error(`Unsupprted compare op.`);
    }

    private not(): void {
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right instanceof BooleanValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(!right.value));
            return;
        }
        throw new Error(`Not operation failed.`);
    }

    private or(): void {
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        const left = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right instanceof BooleanValue && left instanceof BooleanValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(left.value || right.value));
            return;
        }
        throw new Error(`Or operation failed.`);
    }

    private and(): void {
        const right = getOrThrow(this.activeValue).evalStack.popVariable();
        const left = getOrThrow(this.activeValue).evalStack.popVariable();
        if (right instanceof BooleanValue && left instanceof BooleanValue) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(left.value && right.value));
            return;
        }
        throw new Error(`And operation failed.`);
    }

    private handleNewVariable(
        pointer: PointerValue,
        target: VariableValue,
        type: ComponentDescriptor | BuiltInTypeDescriptor,
    ): void {
        if (!target.isMutabled()) {
            throw new Error('Cannot NEW instanciate a constant value.');
        }
        if (type instanceof ComponentDescriptor) {
            if (target.value instanceof ComponentValue) {
                target.value.finalize();
            }
            const component = Runtime.instance().createComponent(type, pointer);
            target.value = component;
            return;
        }

        if (type instanceof TextDescriptor) {
            target.value = new TextValue('');
            return;
        }

        console.warn('Composite Runtime: NEW call ignored for built-in variable type.');
    }

    private handleNew(pointer: PointerValue, operands: Array<InstructionArgument>): void {
        if (operands.length !== 2) {
            throw new Error('Unsupported NEW call, check your code generator.');
        }
        const type = operands[0];
        const nArgs = operands[1];
        if (!(type instanceof ComponentDescriptor || Interpreter.isBuiltInTypeDescriptor(type))) {
            throw new Error('NEW Component or built-in type expected.');
        }

        if (!(nArgs instanceof IntegerDescriptor)) {
            throw new Error('Expected number of args as second argument.');
        }

        const target = getOrThrow(this.activeValue).evalStack.pop();

        for (let i = 0; i < nArgs.initialValue; ++i) {
            // ignore for now:
            getOrThrow(this.activeValue).evalStack.pop();
        }

        if (target instanceof VariableValue) {
            this.handleNewVariable(pointer, target, type);
            return;
        }

        throw new Error('Unsupported NEW. NEW target must be a variable.');
    }

    private static readonly indexJoiner = '@___@:::@___@';

    private loadVariableIndex(descriptor: VariableDescriptor): string {
        const index = new Array<IndexTypes>();
        descriptor.indexTypes.forEach(() => {
            const stackValue = getOrThrow(this.activeValue).evalStack.popVariable();
            if (stackValue instanceof UndefinedValue) {
                throw new Error('Load index value undefined!');
            }
            if (Interpreter.isBuiltInValue(stackValue)) {
                index.push(stackValue.value);
                return;
            }
            if (stackValue instanceof ComponentPointer) {
                index.push(stackValue.address);
                return;
            }
            throw new Error('Illegal Variable Index.');
        });
        return index.join(Interpreter.indexJoiner);
    }

    private handleDelete(): void {
        const target = getOrThrow(this.activeValue).evalStack.pop();
        if (!(target instanceof VariableValue || target instanceof ArrayVariableValue)) {
            throw new Error('Only variables can be deleted.');
        }

        if (target instanceof VariableValue) {
            if (target.value instanceof ComponentValue) {
                target.value.finalize();
                return;
            }
            target.value = new UndefinedValue(target.descriptor.type);
            return;
        }
        const index = this.loadVariableIndex(target.descriptor);
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
            const value = getOrThrow(this.activeValue).evalStack.popVariable();
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
        const service = getOrThrow(this.activeValue).evalStack.popVariable();
        if (!(service instanceof ServicePointer)) {
            throw new Error('Expected target service to send to.');
        }
        const message = this.loadMessage(operands[0]);
        Runtime.instance().send(service, message);
    }

    private handleReceive(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescriptor required for receiving.');
        }
        const descriptor = operands[0];
        const target = getOrThrow(this.activeValue).evalStack.popVariable();
        if (!(target instanceof ServicePointer)) {
            throw new Error('Receiver must be a service.');
        }
        const wait = () => {
            const message = Runtime.instance().receive(target, descriptor);
            if (message === Runtime.finishMessage) {
                return false;
            }
            if (message !== undefined) {
                message.fields.forEach((element) => {
                    getOrThrow(this.activeValue).evalStack.push(element);
                    this.storeVariable();
                });
                return false;
            }
            return true;
        };
        if (wait()) {
            getOrThrow(this.activeValue).wait(wait.bind(this));
        }
    }

    private handleConnect(): void {
        const to = getOrThrow(this.activeValue).evalStack.popVariable();
        if (!(to instanceof ComponentPointer)) {
            // TODO: check if service pointer is possible here as well. Keeping it to components for now.
            throw new Error('Connect target needs to be either a component.');
        }
        const service = getOrThrow(this.activeValue).evalStack.popVariable();
        if (!(service instanceof ServicePointer)) {
            throw new Error('Service required for from.');
        }
        //const from = getOrThrow(this.activeValue).evalStack.popVariable();
        //if (!(from instanceof ComponentPointer)) {
        //    throw new Error('Connect requires a component.');
        //}
        Runtime.instance().connect(to, service);
    }

    private handleDisconnect(): void {
        const target = getOrThrow(this.activeValue).evalStack.popVariable();
        if (!(target instanceof ComponentPointer)) {
            throw new Error('Need to know from component.');
        }
        const service = getOrThrow(this.activeValue).evalStack.popVariable();
        if (!(service instanceof ServicePointer)) {
            throw new Error('Service required for disconnecting.');
        }
        Runtime.instance().disconnect(target, service);
        // TODO
    }

    private handleReceiveCheck(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescriptor required for receiving.');
        }
        const descriptor = operands[0];
        const target = getOrThrow(this.activeValue).evalStack.popVariable();
        if (!(target instanceof ServicePointer)) {
            throw new Error('Receiver must be a component or service.');
        }
        const wait = () => {
            const message = Runtime.instance().receiveTest(target);
            if (message === undefined) {
                return true;
            }
            if (equal(message.descriptor, descriptor)) {
                getOrThrow(this.activeValue).evalStack.push(new BooleanValue(true));
                return false;
            }
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(false));
            return false;
        };
        if (wait()) {
            getOrThrow(this.activeValue).wait(wait.bind(this));
        }
    }

    private handleInputCheck(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof MessageDescriptor)) {
            throw new Error('MessageDescriptor required for receiving.');
        }
        const descriptor = operands[0];
        const target = getOrThrow(this.activeValue).evalStack.popVariable();
        if (!(target instanceof ServicePointer)) {
            throw new Error('Receiver must be a component or service.');
        }
        const message = Runtime.instance().receiveTest(target);
        if (message !== undefined && equal(message.descriptor, descriptor)) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(true));
            return;
        }
        getOrThrow(this.activeValue).evalStack.push(new BooleanValue(false));
    }

    private handleSystemCall(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof SystemCallDescriptor)) {
            throw new Error('Invalid system call.');
        }
        this.systemCallHandler.handle(getOrThrow(this.activeValue), operands[0]);
    }

    private handleProcedurecall(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1 || !(operands[0] instanceof ProcedureDescriptor)) {
            throw new Error('Invalid procedure call.');
        }
        // TODO should we support out variables?
        const args = new Array<ComponentPointer | BuiltInValue>();
        operands[0].parameters.forEach(() => {
            const value = getOrThrow(this.activeValue).evalStack.popVariable();
            if (value instanceof ComponentPointer || Interpreter.isBuiltInValue(value)) {
                args.push(value);
                return;
            }
            throw new Error('Failed to pass value to procedure.');
        });
        getOrThrow(this.activeValue).call(operands[0], args);
    }

    private handleReturn(): void {
        getOrThrow(this.activeValue).procedureReturned();
    }

    private loadBoolean(operands: Array<InstructionArgument>): void {
        if (operands.length > 0 && operands[0] instanceof BooleanDescriptor) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Boolean load operation failed.`);
    }

    private loadText(operands: Array<InstructionArgument>): void {
        if (operands.length >= 1 && operands[0] instanceof TextDescriptor) {
            getOrThrow(this.activeValue).evalStack.push(new TextValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Text load operation failed.`);
    }

    private loadCharacter(operands: Array<InstructionArgument>): void {
        if (operands.length >= 1 && operands[0] instanceof CharacterDescriptor) {
            getOrThrow(this.activeValue).evalStack.push(new CharacterValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Character load operation failed.`);
    }

    private loadFloat(operands: Array<InstructionArgument>): void {
        if (operands.length > 0 && operands[0] instanceof FloatDescriptor) {
            getOrThrow(this.activeValue).evalStack.push(new FloatValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Float load operation failed.`);
    }

    private loadInteger(operands: Array<InstructionArgument>): void {
        if (operands.length > 0 && operands[0] instanceof IntegerDescriptor) {
            getOrThrow(this.activeValue).evalStack.push(new IntegerValue(operands[0].initialValue));
            return;
        }
        throw new Error(`Integer load operation failed.`);
    }

    private storeVariable(): void {
        const value = getOrThrow(this.activeValue).evalStack.popVariable();
        const variable = getOrThrow(this.activeValue).evalStack.pop();
        if (variable instanceof VariableValue) {
            if (!variable.isMutabled()) {
                throw new Error('Cannot assign value to a constant.');
            }
            const varValue = variable.value;
            if (
                varValue instanceof UndefinedValue &&
                (Interpreter.isBuiltInValue(value) || value instanceof ComponentPointer)
            ) {
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
            variable.value.set(this.loadVariableIndex(variable.descriptor), value);
            return;
        }
        throw new Error(`Unsupported Variable Store.`);
    }

    private findVariable(operands: Array<InstructionArgument>): VariableValue | ArrayVariableValue {
        if (operands.length !== 1) {
            throw new Error('Expected single argument for variable load only.');
        }
        if (operands[0] instanceof VariableDescriptor) {
            let current = getOrThrow(this.activeValue);
            let parent = this.loadParentValue(current);
            let variable = current.variables.find((variable) => variable.descriptor === operands[0]);
            while (variable === undefined && parent !== undefined) {
                current = parent;
                parent = this.loadParentValue(current);
                variable = current.variables.find((variable) => equal(variable.descriptor, operands[0]));
            }
            if (variable !== undefined) {
                return variable;
            }
        }
        throw new Error('Failed to find variable.');
    }

    private loadVariable(operands: Array<InstructionArgument>): void {
        const variable = this.findVariable(operands);
        if (variable instanceof VariableValue) {
            getOrThrow(this.activeValue).evalStack.push(variable);
            return;
        }
        throw new Error(`Unsupported Variable Load.`);
    }

    loadArrayVariable(operands: Array<InstructionArgument>): void {
        const variable = this.findVariable(operands);
        if (
            variable instanceof ArrayVariableValue ||
            (variable instanceof VariableValue && variable.descriptor.type instanceof TextDescriptor)
        ) {
            getOrThrow(this.activeValue).evalStack.push(variable);
            return;
        }
        console.log(variable);
        throw new Error(`Unsupported Array Variable Load.`);
    }

    loadArrayVariableElement(operands: Array<InstructionArgument>): void {
        const variable = this.findVariable(operands);
        if (variable instanceof ArrayVariableValue) {
            const index = this.loadVariableIndex(variable.descriptor);
            if (!variable.value.has(index)) {
                variable.value.set(
                    index,
                    new VariableValue(variable.descriptor, new UndefinedValue(variable.descriptor.type)),
                );
            }
            getOrThrow(this.activeValue).evalStack.push(getOrThrow(variable.value.get(index)));
            return;
        }
        throw new Error(`Unsupported Array Variable Element Load.`);
    }

    private loadService(operands: Array<InstructionArgument>): void {
        if (operands.length === 1 && operands[0] instanceof InterfaceDescriptor) {
            const pointer = getOrThrow(this.activeValue).evalStack.popVariable();
            if (pointer instanceof ComponentPointer) {
                const service = Runtime.instance().getService(operands[0], pointer);
                getOrThrow(this.activeValue).evalStack.push(service);
                return;
            }
        }
        throw new Error(`Unsupported Service Load.`);
    }

    private loadThis(pointer: PointerValue): void {
        if (pointer instanceof ServicePointer || pointer instanceof ComponentPointer) {
            getOrThrow(this.activeValue).evalStack.push(pointer);
            return;
        }
        throw new Error('Load this only for services supported.');
    }

    private handleAcquireExclusive(): void {
        const wait = () => {
            const newLock = Runtime.instance().acquireExclusive(getOrThrow(this.activeValue).exclusiveLock);
            if (newLock === undefined) {
                return true;
            }
            getOrThrow(this.activeValue).exclusiveLock = newLock;
            return false;
        };
        if (wait()) {
            getOrThrow(this.activeValue).wait(wait.bind(this));
        }
    }

    private handleReleaseExclusive(): void {
        const wait = () => {
            const success = Runtime.instance().releaseExclusive(getOrThrow(this.activeValue).exclusiveLock);
            if (success) {
                getOrThrow(this.activeValue).exclusiveLock = undefined;
            }
            return !success;
        };
        if (wait()) {
            getOrThrow(this.activeValue).wait(wait.bind(this));
        }
    }

    private branch(operands: Array<InstructionArgument>): void {
        if (operands.length !== 1) {
            throw new Error(`Branch conditions must have one operand.`);
        }
        const operand = operands[0];
        if (operand instanceof JumpDescriptor) {
            getOrThrow(this.activeValue).jump(operand);
            return;
        }
        throw new Error(`Failed jump.`);
    }

    private branchConditionally(branch: boolean, operands: Array<InstructionArgument>): void {
        const condition = getOrThrow(this.activeValue).evalStack.popVariable();
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
        console.log(condition);
        console.log(this.activeValue?.evalStack);
        throw new Error(`Conditional jump failed.`);
    }

    private handleIsType(operands: Array<InstructionArgument>): void {
        const variable = getOrThrow(this.activeValue).evalStack.pop();
        if (operands.length !== 1) {
            throw new Error(`IsType check must have one operand.`);
        }
        const operand = operands[0];
        if (variable instanceof VariableValue && operand instanceof ComponentDescriptor) {
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(equal(variable.descriptor.type, operand)));
            return;
        }
        throw new Error('IsType check failed.');
    }

    private handleExists(): void {
        const variable = getOrThrow(this.activeValue).evalStack.popVariable();
        getOrThrow(this.activeValue).evalStack.push(new BooleanValue(!(variable instanceof UndefinedValue)));
    }

    private handleForEachBegin(): void {
        getOrThrow(this.activeValue).evalStack.push(new ArrayIndexValue());
    }

    private handleForEachEnd(): void {
        const endIndex = getOrThrow(this.activeValue).evalStack.pop();
        if (endIndex instanceof ArrayIndexValue) {
            return;
        }
        throw new Error('ForEach Stack Issue.');
    }

    private handleAssignArrayIndex(): void {
        const variable = getOrThrow(this.activeValue).evalStack.pop();
        if (!(variable instanceof ArrayVariableValue)) {
            console.log(variable);
            throw new Error('Expected array variable in foreach.');
        }
        const indexVars = new Array<VariableValue>();
        variable.descriptor.indexTypes.forEach(() => {
            const stackValue = getOrThrow(this.activeValue).evalStack.pop();
            if (!(stackValue instanceof VariableValue)) {
                throw new Error('Variable required to assign to.');
            }
            indexVars.push(stackValue);
        });
        const indexToLoad = getOrThrow(this.activeValue).evalStack.pop();
        if (!(indexToLoad instanceof ArrayIndexValue)) {
            throw new Error('Array index value expected.');
        }
        const keys = Array.from(variable.value.keys());
        if (variable.value.size === 0 || indexToLoad.value >= keys.length) {
            getOrThrow(this.activeValue).evalStack.push(indexToLoad);
            getOrThrow(this.activeValue).evalStack.push(new BooleanValue(false));
            return;
        }
        const indexes = keys[indexToLoad.value].split(Interpreter.indexJoiner);
        if (indexes.length !== indexVars.length) {
            throw new Error('Index assignment number of indexes mismatch');
        }

        indexVars.forEach((value, i) => {
            const stringIndex = indexes[i];
            if (value.descriptor.type instanceof ComponentDescriptor) {
                const address = Number.parseInt(stringIndex);
                const pointer = Runtime.instance().getPointerFromAddress(address);
                if (!(pointer instanceof ComponentPointer)) {
                    throw new Error('Index type mismatch.');
                }
                value.value = pointer;
                return;
            }
            if (value.descriptor.type instanceof IntegerDescriptor) {
                const indexValue = Number.parseInt(stringIndex);
                value.value = new IntegerValue(indexValue);
                return;
            }
            if (value.descriptor.type instanceof FloatDescriptor) {
                const indexValue = Number.parseFloat(stringIndex);
                value.value = new FloatValue(indexValue);
                return;
            }
            if (value.descriptor.type instanceof TextDescriptor) {
                value.value = new TextValue(stringIndex);
                return;
            }
            if (value.descriptor.type instanceof CharacterDescriptor) {
                value.value = new CharacterValue(stringIndex);
                return;
            }
            if (value.descriptor.type instanceof BooleanDescriptor) {
                if (stringIndex === 'true') {
                    value.value = new BooleanValue(true);
                    return;
                }
                if (stringIndex === 'false') {
                    value.value = new BooleanValue(false);
                    return;
                }
            }
            throw new Error('Failed index type conversion.');
        });
        getOrThrow(this.activeValue).evalStack.push(new ArrayIndexValue(indexToLoad.value + 1));
        getOrThrow(this.activeValue).evalStack.push(new BooleanValue(true));
    }

    async process(pointer: PointerValue): Promise<void> {
        this.loadValue(pointer);
        if (getOrThrow(this.activeValue).isDone()) {
            this.unloadValue();
            return;
        }
        const nextInstruction = getOrThrow(this.activeValue).fetch();
        if (nextInstruction === undefined) {
            this.unloadValue();
            return;
        }
        switch (nextInstruction.code) {
            case OperationCode.Add:
                this.add();
                break;
            case OperationCode.Subtract:
                this.sub();
                break;
            case OperationCode.Multiply:
                this.mul();
                break;
            case OperationCode.Divide:
                this.div();
                break;
            case OperationCode.Negate:
                this.negate();
                break;
            case OperationCode.Modulo:
                this.mod();
                break;
            case OperationCode.Equal:
            case OperationCode.Less:
            case OperationCode.LessEqual:
            case OperationCode.Greater:
            case OperationCode.GreaterEqual:
            case OperationCode.NotEqual:
                this.handleCompareOp(nextInstruction.code);
                break;
            case OperationCode.Not:
                this.not();
                break;
            case OperationCode.LogicOr:
                this.or();
                break;
            case OperationCode.LogicAnd:
                this.and();
                break;
            case OperationCode.New:
                this.handleNew(pointer, nextInstruction.arguments);
                break;
            case OperationCode.Delete:
                this.handleDelete();
                break;
            case OperationCode.Send:
                this.handleSend(nextInstruction.arguments);
                break;
            case OperationCode.Receive:
                this.handleReceive(nextInstruction.arguments);
                break;
            case OperationCode.Connect:
                this.handleConnect();
                break;
            case OperationCode.Disconnect:
                this.handleDisconnect();
                break;
            case OperationCode.ReceiveTest:
                this.handleReceiveCheck(nextInstruction.arguments);
                break;
            case OperationCode.InputTest:
                this.handleInputCheck(nextInstruction.arguments);
                break;
            case OperationCode.SystemCall:
                this.handleSystemCall(nextInstruction.arguments);
                break;
            case OperationCode.ProcedureCall:
                this.handleProcedurecall(nextInstruction.arguments);
                break;
            case OperationCode.Return:
                this.handleReturn();
                break;
            case OperationCode.LoadConstantBoolean:
                this.loadBoolean(nextInstruction.arguments);
                break;
            case OperationCode.LoadConstantText:
                this.loadText(nextInstruction.arguments);
                break;
            case OperationCode.LoadConstantCharacter:
                this.loadCharacter(nextInstruction.arguments);
                break;
            case OperationCode.LoadConstantFloat:
                this.loadFloat(nextInstruction.arguments);
                break;
            case OperationCode.LoadConstantInteger:
                this.loadInteger(nextInstruction.arguments);
                break;
            case OperationCode.Move:
                throw new Error('MOVE is not yet supported.');
            case OperationCode.StoreVariable:
                this.storeVariable();
                break;
            case OperationCode.LoadVariable:
                this.loadVariable(nextInstruction.arguments);
                break;
            case OperationCode.LoadArrayVariable:
                this.loadArrayVariable(nextInstruction.arguments);
                break;
            case OperationCode.LoadArrayVariableElement:
                this.loadArrayVariableElement(nextInstruction.arguments);
                break;
            case OperationCode.LoadService:
                this.loadService(nextInstruction.arguments);
                break;
            case OperationCode.LoadThis:
                this.loadThis(pointer);
                break;
            case OperationCode.AcquireShared:
                // TODO: Can be ignored for now
                console.warn('Composite Runtime: Acquire SHARED ignored.');
                break;
            case OperationCode.ReleaseShared:
                // TODO: Can be ignored for now
                console.warn('Composite Runtime: Release SHARED ignored.');
                break;
            case OperationCode.AcquireExclusive:
                this.handleAcquireExclusive();
                break;
            case OperationCode.ReleaseExclusive:
                this.handleReleaseExclusive();
                break;
            case OperationCode.Branch:
                this.branch(nextInstruction.arguments);
                break;
            case OperationCode.BranchTrue:
                this.branchConditionally(true, nextInstruction.arguments);
                break;
            case OperationCode.BranchFalse:
                this.branchConditionally(false, nextInstruction.arguments);
                break;
            case OperationCode.IsType:
                this.handleIsType(nextInstruction.arguments);
                break;
            case OperationCode.ExistsTest:
                this.handleExists();
                break;
            case OperationCode.BeginForEach:
                this.handleForEachBegin();
                break;
            case OperationCode.EndForEach:
                this.handleForEachEnd();
                break;
            case OperationCode.AssignArrayIndex:
                this.handleAssignArrayIndex();
                break;
        }
        this.unloadValue();
    }
}
