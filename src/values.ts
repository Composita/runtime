import {
    ComponentDescriptor,
    DeclarationDescriptor,
    ImplementationDescriptor,
    Instruction,
    InterfaceDescriptor,
    JumpDescriptor,
    MessageDescriptor,
    ProcedureDescriptor,
    TypeDescriptor,
    VariableDescriptor,
} from '@composita/il';
import { Optional } from '@composita/ts-utility-types';
import { StackValue } from './evalstack';

export enum ActiveCode {
    Init,
    Begin,
    Activity,
    Finally,
    Procedure,
}

//export type DeclarationHolder = ComponentValue | ServiceValue | ProcedureValue;
export type VariableValues = VariableValue | ArrayVariableValue;

export type PointerValue = ComponentPointer | ServicePointer | ProcedurePointer | RootPointer;

enum ComponentPointerTag {
    Tag,
}
export class ComponentPointer {
    constructor(public readonly address: number, public readonly type: ComponentDescriptor) {}
    protected readonly _componentPointerTag = ComponentPointerTag.Tag;
}
enum ServicePointerTag {
    Tag,
}
export class ServicePointer {
    constructor(public readonly address: number, public readonly type: InterfaceDescriptor) {}
    protected readonly _servicePointerTag = ServicePointerTag.Tag;
}
enum ProcedurePointerTag {
    Tag,
}
export class ProcedurePointer {
    constructor(public readonly address: number, public readonly type: ProcedureDescriptor) {}
    protected readonly _procedurePointerTag = ProcedurePointerTag.Tag;
}
enum RootPointerTag {
    Tag,
}
export class RootPointer {
    protected readonly _rootPointerTag = RootPointerTag.Tag;
}

export abstract class ActiveValue {
    constructor(private readonly declarations: DeclarationDescriptor, public readonly parent: PointerValue) {}
    public readonly variables = new Array<VariableValues>();
    //public readonly services = new Array<ServicePointer>();
    public readonly procedures = new Array<ProcedureValue>();

    protected abstract fetchNext(): Optional<Instruction>;

    fetch(): Optional<Instruction> {
        this.updateActiveSection();
        if (this.isDone()) {
            return undefined;
        }
        switch (this.activeCode) {
            case ActiveCode.Init:
                return this.declarations.init.instructions[this.loadAndAdvanceIP()];
            case ActiveCode.Procedure:
                return this.procedures[this.loadIP()]?.fetch();
            default:
                return this.fetchNext();
        }
    }

    jump(descriptor: JumpDescriptor): void {
        if (this.isDone()) {
            return;
        }
        const currentIP = this.instructionPointer.get(this.activeCode) as number;
        const newIP = currentIP + descriptor.offset;
        if (newIP < 0) {
            throw new Error('Invalid jump.');
        }
        // TODO check max range is still valid.
        this.instructionPointer.set(this.activeCode, newIP);
    }

    call(descriptor: ProcedureDescriptor, args: Array<ComponentPointer | BuiltInValue>): boolean {
        if (args.length !== descriptor.parameters.length) {
            throw new Error('Procedurecall: Number of parameters do not match.');
        }
        if (this.activeCode === ActiveCode.Procedure) {
            this.procedures[this.activeCode]?.call(descriptor, args);
            return false;
        }
        this.lastActiveCode = this.activeCode;
        this.activeCode = ActiveCode.Procedure;
        const procedureIdx = this.procedures.findIndex((prod) => prod.descriptor === descriptor);
        if (procedureIdx === -1) {
            throw new Error('Unkonwn procedure, hierarchical calls are not yet supported.');
        }
        this.instructionPointer.set(this.activeCode, procedureIdx);
        args.forEach((arg, index) => {
            if (arg !== undefined) {
                const paramDescriptor = descriptor.parameters[index];
                const param = new VariableValue(paramDescriptor, arg);
                param.fixAccessModifier();
                this.procedures[procedureIdx].parameters.push(param);
            }
        });
        return true;
    }

    procedureReturned(): void {
        if (this.activeCode !== ActiveCode.Procedure) {
            throw new Error('Return is only supported in a procedure.');
        }
        this.procedures[this.loadIP()]?.markReturned();
    }

    currentState(): ActiveCode {
        return this.activeCode;
    }

    finalize(): void {
        if (this.lastActiveCode === ActiveCode.Finally && this.activeCode === ActiveCode.Procedure) {
            return;
        }
        this.lastActiveCode = this.activeCode;
        this.activeCode = ActiveCode.Finally;
    }

    isDone(): boolean {
        return this.done;
    }

    protected loadIP(): number {
        return this.instructionPointer.get(this.activeCode) as number;
    }

    protected loadAndAdvanceIP(): number {
        const rip = this.loadIP();
        if (this.activeCode !== ActiveCode.Procedure) {
            this.instructionPointer.set(this.activeCode, rip + 1);
        }
        return rip;
    }

    private updateActiveSection(): void {
        if (this.isDone() || !this.activeDone() || !this.isReady()) {
            return;
        }
        // Done with current code section
        if (this.activeCode === ActiveCode.Init) {
            this.lastActiveCode = this.activeCode;
            this.activeCode = ActiveCode.Begin;
            this.variables.forEach((variable) => {
                if (variable instanceof VariableValue) {
                    variable.fixAccessModifier();
                }
            });
            this.updateActiveSection();
            return;
        }
        if (this.activeCode === ActiveCode.Begin) {
            this.lastActiveCode = this.activeCode;
            this.activeCode = ActiveCode.Activity;
            this.updateActiveSection();
            return;
        }
        if (this.activeCode === ActiveCode.Activity) {
            this.lastActiveCode = this.activeCode;
            this.activeCode = ActiveCode.Finally;
            this.updateActiveSection();
            return;
        }
        if (this.activeCode === ActiveCode.Procedure) {
            this.activeCode = this.lastActiveCode;
            this.lastActiveCode = ActiveCode.Procedure;
            this.updateActiveSection();
            return;
        }
        if (this.activeCode === ActiveCode.Finally) {
            this.lastActiveCode = this.activeCode;
            this.done = true;
            return;
        }
    }

    private activeDone(): boolean {
        const activeIP = this.loadIP();
        if (this.initActive()) {
            return activeIP >= this.declarations.init.instructions.length;
        }
        if (this.procedureActive()) {
            return this.procedures[activeIP] === undefined || this.procedures[activeIP].isDone();
        }
        return this.activeCodeDone();
    }

    protected abstract activeCodeDone(): boolean;
    protected abstract isReady(): boolean;

    private initActive(): boolean {
        return this.activeCode === ActiveCode.Init;
    }

    private procedureActive(): boolean {
        return this.activeCode === ActiveCode.Procedure;
    }

    protected resetActive(): void {
        this.done = false;
        this.activeCode = ActiveCode.Init;
        this.lastActiveCode = ActiveCode.Init;
        this.instructionPointer = new Map([
            [ActiveCode.Init, 0],
            [ActiveCode.Begin, 0],
            [ActiveCode.Activity, 0],
            [ActiveCode.Finally, 0],
            [ActiveCode.Procedure, 0],
        ]);
    }

    protected done = false;
    protected activeCode = ActiveCode.Init;
    protected lastActiveCode = ActiveCode.Init;
    protected instructionPointer = new Map<ActiveCode, number>([
        [ActiveCode.Init, 0],
        [ActiveCode.Begin, 0],
        [ActiveCode.Activity, 0],
        [ActiveCode.Finally, 0],
        [ActiveCode.Procedure, 0],
    ]);
}

export class ComponentValue extends ActiveValue {
    constructor(public readonly descriptor: ComponentDescriptor, parent: PointerValue) {
        super(descriptor.declarations, parent);
        this.offerConnections = new Map<InterfaceDescriptor, Optional<ServicePointer>>();
        this.requiredConnections = new Map<InterfaceDescriptor, Optional<ServicePointer>>();
        descriptor.offers.forEach((offer) => this.offerConnections.set(offer, undefined));
        descriptor.requires.forEach((require) => this.requiredConnections.set(require, undefined));
    }

    public readonly offerConnections: Map<InterfaceDescriptor, Optional<ServicePointer>>;
    public readonly requiredConnections: Map<InterfaceDescriptor, Optional<ServicePointer>>;

    protected fetchNext(): Optional<Instruction> {
        switch (this.activeCode) {
            case ActiveCode.Begin:
                return this.loadIP() < this.descriptor.begin.instructions.length
                    ? this.descriptor.begin.instructions[this.loadAndAdvanceIP()]
                    : undefined;
            case ActiveCode.Activity:
                return this.loadIP() < this.descriptor.activity.instructions.length
                    ? this.descriptor.activity.instructions[this.loadAndAdvanceIP()]
                    : undefined;
            case ActiveCode.Finally:
                return this.descriptor.finally.instructions[this.loadAndAdvanceIP()];
            default:
                return undefined;
        }
    }

    protected isReady(): boolean {
        let result = true;
        this.requiredConnections.forEach((value) => {
            result = result && value !== undefined;
        });
        return result;
    }

    protected activeCodeDone(): boolean {
        const activeIP = this.loadIP();
        switch (this.activeCode) {
            case ActiveCode.Begin:
                return /* this.requiredConnected() && */ activeIP >= this.descriptor.begin.instructions.length;
            case ActiveCode.Activity:
                return /* !this.offeredConnected() && */ activeIP >= this.descriptor.activity.instructions.length;
            case ActiveCode.Finally:
                // TODO
                //{
                //    if (activeIP >= this.descriptor.finally.instructions.length) {
                //        this.disconnectAll();
                //    }
                //}
                return activeIP >= this.descriptor.finally.instructions.length;
            default:
                return true;
        }
    }
}

export class ServiceValue extends ActiveValue {
    constructor(public readonly descriptor: ImplementationDescriptor, parent: ComponentPointer) {
        super(descriptor.declarations, parent);
    }

    public readonly messageQueue = new Array<MessageValue>();

    protected isReady(): boolean {
        return true;
    }

    protected fetchNext(): Optional<Instruction> {
        switch (this.activeCode) {
            case ActiveCode.Begin:
                return this.descriptor.begin.instructions[this.loadAndAdvanceIP()];
            default:
                return undefined;
        }
    }

    protected activeCodeDone(): boolean {
        const activeIP = this.loadIP();
        switch (this.activeCode) {
            case ActiveCode.Begin:
                return this.descriptor.begin.instructions.length <= activeIP;
            default:
                return true;
        }
    }
}

export type ReturnValue = BuiltInValue | ComponentValue;

export class ProcedureValue extends ActiveValue {
    constructor(public readonly descriptor: ProcedureDescriptor, parent: PointerValue) {
        super(descriptor.declarations, parent);
    }

    protected isReady(): boolean {
        return true;
    }

    protected findConnectedService(): Optional<ServiceValue> {
        return undefined;
    }

    private hasReturned = false;

    public parameters = new Array<VariableValue>();

    markReturned(): boolean {
        if (this.activeCode === ActiveCode.Procedure) {
            if (this.procedures[this.loadIP()]?.markReturned()) {
                this.activeCode = this.lastActiveCode;
                this.lastActiveCode = ActiveCode.Procedure;
            }
            return false;
        }
        this.resetActive();
        this.parameters = new Array<VariableValue>();
        return true;
    }

    protected fetchNext(): Optional<Instruction> {
        switch (this.activeCode) {
            case ActiveCode.Begin:
                return this.descriptor.begin.instructions[this.loadAndAdvanceIP()];
            default:
                return undefined;
        }
    }

    protected activeCodeDone(): boolean {
        const activeIP = this.loadIP();
        switch (this.activeCode) {
            case ActiveCode.Begin:
                return !this.hasReturned && this.descriptor.begin.instructions.length <= activeIP;
            default:
                return true;
        }
    }
}

export class MessageValue {
    constructor(public readonly descriptor: MessageDescriptor) {}
    public readonly fields = new Array<BuiltInValue>();
}

export type VariableValueType = BuiltInValue | ComponentPointer;

export class VariableValue {
    constructor(public readonly descriptor: VariableDescriptor, public value: VariableValueType) {}

    private mutable = true;

    isMutabled(): boolean {
        return this.mutable;
    }

    fixAccessModifier(): void {
        this.mutable = this.descriptor.mutable;
    }
}

export type IndexTypes = number | boolean | string;

enum ArrayVariableValueTag {
    Tag,
}
export class ArrayVariableValue {
    constructor(public readonly descriptor: VariableDescriptor, public readonly value: Map<string, StackValue>) {}
    protected readonly _arrayVariableTag = ArrayVariableValueTag.Tag;
}

export type BuiltInValue = IntegerValue | FloatValue | TextValue | CharacterValue | BooleanValue | UndefinedValue;

enum UndefinedValueTag {
    Tag,
}
export class UndefinedValue {
    constructor(public readonly type: TypeDescriptor) {}
    protected readonly _integerTag = UndefinedValueTag.Tag;
}
enum IntegerValueTag {
    Tag,
}
export class IntegerValue {
    constructor(public value: number = 0) {}
    protected readonly _integerTag = IntegerValueTag.Tag;
}
enum FloatValueTag {
    Tag,
}
export class FloatValue {
    constructor(public value: number = 0) {}
    protected readonly _floatTag = FloatValueTag.Tag;
}
enum TextValueTag {
    Tag,
}
export class TextValue {
    constructor(public value: string = '') {}
    protected readonly _textTag = TextValueTag.Tag;
}
enum CharacterValueTag {
    Tag,
}
export class CharacterValue {
    constructor(public value: string = '\0') {}
    protected readonly _characterTag = CharacterValueTag.Tag;
}
enum BooleanValueTag {
    Tag,
}
export class BooleanValue {
    constructor(public value: boolean = false) {}
    protected readonly _booleanTag = BooleanValueTag.Tag;
}

export type NumberValue = IntegerValue | FloatValue;

export type AddableValue = NumberValue | TextValue;

export type ComparableValue = IntegerValue | FloatValue | TextValue | CharacterValue;

export type EquatableValue = ComparableValue | BooleanValue;

export type ShowableValue = NumberValue | TextValue | CharacterValue;
