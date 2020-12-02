import {
    ComponentDescriptor,
    DeclarationDescriptor,
    ImplementationDescriptor,
    Instruction,
    InterfaceDescriptor,
    JumpDescriptor,
    MessageDescriptor,
    ProcedureDescriptor,
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

export type DeclarationHolder = ComponentValue | ServiceValue | ProcedureValue;
export type VariableValues = VariableValue | ArrayVariableValue;

export abstract class ActiveValue {
    constructor(private readonly declarations: DeclarationDescriptor) {}
    public readonly variables = new Array<VariableValues>();
    public readonly services = new Array<ServiceValue>();
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

    call(descriptor: ProcedureDescriptor, args: Array<ComponentValue | BuiltInValue>): boolean {
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
                const param = new VariableValue(paramDescriptor, arg, paramDescriptor.mutable);
                this.procedures[procedureIdx].parameters.push(param);
            }
        });
        return true;
    }

    findService(interfaceDescriptor: InterfaceDescriptor): Optional<ServiceValue> {
        const service = this.services.find((value) => value.descriptor.reference === interfaceDescriptor);
        if (service === undefined) {
            return this.findConnectedService(interfaceDescriptor);
        }
        return service;
    }

    protected abstract findConnectedService(interfaceDescriptor: InterfaceDescriptor): Optional<ServiceValue>;

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
        if (this.isDone() || !this.activeDone()) {
            return;
        }
        // Done with current code section
        if (this.activeCode === ActiveCode.Init) {
            this.lastActiveCode = this.activeCode;
            this.activeCode = ActiveCode.Begin;
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
    constructor(public readonly descriptor: ComponentDescriptor, public readonly parent: Optional<ActiveValue>) {
        super(descriptor.declarations);
    }

    private readonly connectedInterfaces = new Map<InterfaceDescriptor, Array<ServiceValue>>();

    protected findConnectedService(interfaceDescriptor: InterfaceDescriptor): Optional<ServiceValue> {
        const services = this.connectedInterfaces.get(interfaceDescriptor);
        if (services === undefined || services.length === 0) {
            return undefined;
        }
        // just return the first serivce for now.
        return services[0];
    }

    canConnect(service: ServiceValue): boolean {
        return this.descriptor.requires.filter((desc) => desc === service.descriptor.reference).length > 0;
    }

    connect(service: ServiceValue): void {
        if (!this.canConnect(service)) {
            throw new Error('Cannot connect service. No interface required by this component.');
        }
        const existing = this.connectedInterfaces.get(service.descriptor.reference);
        existing?.push(service) ?? this.connectedInterfaces.set(service.descriptor.reference, new Array(service));
    }

    disconnect(service: ServiceValue): void {
        const existing = this.connectedInterfaces.get(service.descriptor.reference);
        if (existing !== undefined) {
            this.connectedInterfaces.set(
                service.descriptor.reference,
                existing.filter((value) => value === service),
            );
        }
    }

    // return true only if all required interfaces have been wired up.
    ready(): boolean {
        return (
            this.descriptor.requires.filter((interfaceDescriptor) => !this.connectedInterfaces.has(interfaceDescriptor))
                .length === 0
        );
    }

    protected fetchNext(): Optional<Instruction> {
        switch (this.activeCode) {
            case ActiveCode.Begin:
                return this.descriptor.begin.instructions[this.loadAndAdvanceIP()];
            case ActiveCode.Activity:
                return this.ready() ? this.descriptor.activity.instructions[this.loadAndAdvanceIP()] : undefined;
            case ActiveCode.Finally:
                return this.descriptor.finally.instructions[this.loadAndAdvanceIP()];
            default:
                return undefined;
        }
    }

    protected activeCodeDone(): boolean {
        const activeIP = this.loadIP();
        switch (this.activeCode) {
            case ActiveCode.Begin:
                return activeIP >= this.descriptor.begin.instructions.length;
            case ActiveCode.Activity:
                return activeIP >= this.descriptor.activity.instructions.length;
            case ActiveCode.Finally:
                return activeIP >= this.descriptor.finally.instructions.length;
            default:
                return true;
        }
    }
}

export class ServiceValue extends ActiveValue {
    constructor(public readonly descriptor: ImplementationDescriptor, public readonly parent: ComponentValue) {
        super(descriptor.declarations);
    }

    private canStart = false;

    protected findConnectedService(): Optional<ServiceValue> {
        return undefined;
    }

    start(): void {
        this.canStart = true;
    }

    protected fetchNext(): Optional<Instruction> {
        if (!this.canStart) {
            return undefined;
        }
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
    constructor(public readonly descriptor: ProcedureDescriptor, public readonly parent: DeclarationHolder) {
        super(descriptor.declarations);
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

export type VariableValueType = BuiltInValue | ComponentValue;

export class VariableValue {
    constructor(
        public readonly descriptor: VariableDescriptor,
        public value: VariableValueType,
        public readonly mutable: boolean,
    ) {}
}

export type ArrayIndexType = Array<StackValue>;

enum ArrayVariableValueTag {
    Tag,
}
export class ArrayVariableValue {
    constructor(
        public readonly descriptor: VariableDescriptor,
        public readonly value: Map<ArrayIndexType, VariableValue>,
    ) {}
    protected readonly _arrayVariableTag = ArrayVariableValueTag.Tag;
}

export type BuiltInValue = undefined | IntegerValue | FloatValue | TextValue | CharacterValue | BooleanValue;

enum IntegerValueTag {
    Tag,
}
export class IntegerValue {
    constructor(public value: number) {}
    protected readonly _integerTag = IntegerValueTag.Tag;
}
enum FloatValueTag {
    Tag,
}
export class FloatValue {
    constructor(public value: number) {}
    protected readonly _floatTag = FloatValueTag.Tag;
}
enum TextValueTag {
    Tag,
}
export class TextValue {
    constructor(public value: string) {}
    protected readonly _textTag = TextValueTag.Tag;
}
enum CharacterValueTag {
    Tag,
}
export class CharacterValue {
    constructor(public value: string) {}
    protected readonly _characterTag = CharacterValueTag.Tag;
}
enum BooleanValueTag {
    Tag,
}
export class BooleanValue {
    constructor(public value: boolean) {}
    protected readonly _booleanTag = BooleanValueTag.Tag;
}

export type NumberValue = IntegerValue | FloatValue;

export type AddableValue = NumberValue | TextValue;

export type ComparableValue = IntegerValue | FloatValue | TextValue | CharacterValue;

export type EquatableValue = ComparableValue | BooleanValue;

export type ShowableValue = NumberValue | TextValue | CharacterValue;
