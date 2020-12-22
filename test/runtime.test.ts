import { default as tape } from 'tape';

import { Runtime } from '../src/runtime';
import { Compiler } from '@composita/compiler';

export class OutputCapture {
    private output = '';

    getOutput(): string {
        return this.output;
    }

    capture(...msgs: Array<string>): void {
        msgs.forEach((msg) => {
            this.output = this.output + msg;
        });
    }
}

tape('For By Dec Loop', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } ForLoop;
  VARIABLE i: INTEGER;
BEGIN
FOR i := 9 TO 1 BY -3 DO
  WRITE("Hello World"); WRITELINE
END
END ForLoop;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), 'Hello World\nHello World\nHello World\n', 'For By Dec Loop Complete.');
    test.end();
});

tape('For By Loop', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } ForLoop;
    VARIABLE i: INTEGER;
BEGIN
  FOR i := 1 TO 9 BY 3 DO
    WRITE("Hello World"); WRITELINE
  END
END ForLoop;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), 'Hello World\nHello World\nHello World\n', 'For By Loop Complete.');
    test.end();
});

tape('For Loop', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } ForLoop;
    VARIABLE i: INTEGER;
BEGIN
  FOR i := 1 TO 3 DO
    WRITE("Hello World"); WRITELINE
  END
END ForLoop;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), 'Hello World\nHello World\nHello World\n', 'For Loop Complete.');
    test.end();
});

tape('Hello World', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } HelloWorld;
  BEGIN
    WRITE("Hello World"); WRITELINE
END HelloWorld;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), 'Hello World\n', 'Hello World Complete.');
    test.end();
});

tape('Double Hello World', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } HelloWorld;
  BEGIN
    WRITE("Hello World"); WRITELINE
END HelloWorld;

COMPONENT { ENTRYPOINT } HelloWorld2;
  BEGIN
    WRITE("Hello World2\n")
END HelloWorld2;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), 'Hello WorldHello World2\n\n', 'Hello World Complete.');
    test.end();
});
tape('NEW Hello World', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } HelloWorld;
    VARIABLE nh: NewHelloWorld;
BEGIN
  NEW(nh);
  NEW(nh);
  WRITE("a");
  WRITE("b");
  WRITE("c");
  WRITE("d");
  WRITE("e");
  WRITE("f")
FINALLY
  WRITE("OHD")
END HelloWorld;

COMPONENT NewHelloWorld;
BEGIN
  WRITE(1);
  WRITE(2);
  WRITE(3);
  WRITE(4);
  WRITE(5);
  WRITE(6);
  WRITE(7);
  WRITE(8);
  WRITE(9);
  WRITE("Hello World");
  WRITELINE
FINALLY
  WRITE("FINALLY")
END NewHelloWorld;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    // Disabled for now.
    //test.equal(
    //    outputCapture.getOutput(),
    //    '1FINALLY1a2b3c4d5e6f7OHD89Hello World\nFINALLY',
    //    'NEW Hello World Complete.',
    //);
    test.end();
});

tape('Basic arcsin.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
BEGIN
  WRITE(ARCSIN(0.))
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), '0', 'ARCSIN(0).');
    test.end();
});

tape('Basic cos.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
BEGIN
WRITE(COS(PI))
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), '-1', 'COS(PI).');
    test.end();
});

tape('Basic if false comparison.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  BEGIN
    IF 2 < 1 + 1 THEN
      WRITE("NOT TRUE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), '', '2 < 1 + 1 false.');
    test.end();
});

tape('Another basic if false comparison.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  BEGIN
    IF 1 + 1 < 2 THEN
      WRITE("NOT TRUE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), '', '1 + 1 < 2 false.');
    test.end();
});

tape('Basic if true comparison.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  BEGIN
    IF 2 <= 1 + 1 THEN
      WRITE("TRUE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), 'TRUE', '2 <= 1 + 1.');
    test.end();
});

tape('Another basic if true comparison.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  BEGIN
    IF 1 + 1 <= 2 THEN
      WRITE("TRUE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), 'TRUE', '1 + 1 <= 2.');
    test.end();
});

tape('Basic Math.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  BEGIN
    WRITE(1 + 10 - 11)
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), '0', '1 + 10 - 11 = 0.');
    test.end();
});

tape('Foreach loop.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  VARIABLE
    room[number: INTEGER; x1: TEXT; x2: BOOLEAN]: INTEGER;
    i: INTEGER; t: TEXT; b: BOOLEAN;
  CONSTANT
    limit = 10;
  BEGIN
    FOR i := 1 TO limit DO
      room[i, TEXT("T"), TRUE] := i * 10
    END;
    room[3, TEXT("T"), FALSE] := 333;
    room[3, TEXT("A"), FALSE] := 666;
    IF i IS INTEGER THEN
      WRITE("i is an INTEGER"); WRITELINE
    END;
    FOREACH i, t, b OF room DO
      WRITE(i); WRITE(" "); WRITE(t); WRITE(" ");
      IF b THEN
        WRITE("TRUE")
      ELSE
        WRITE("FALSE")
      END;
      WRITE(" ");
      WRITE(room[i, t, b]); WRITELINE
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(
        outputCapture.getOutput(),
        'i is an INTEGER\n1 T TRUE 10\n2 T TRUE 20\n3 T TRUE 30\n4 T TRUE 40\n5 T TRUE 50\n6 T TRUE 60\n7 T TRUE 70\n8 T TRUE 80\n9 T TRUE 90\n10 T TRUE 100\n3 T FALSE 333\n3 A FALSE 666\n',
        'ForEach loop fail.',
    );
    test.end();
});

tape('Another basic comparison.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  BEGIN
    IF 1 + 10 < 1 THEN
      WRITE("FALSE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), '', '1 + 10 < 1 false.');
    test.end();
});

tape('Basic Math.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  BEGIN
    WRITE(-1 + 10 - 11)
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), '-2', '-2 + 10 - 11 = -2.');
    test.end();
});

tape('Basic Math.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  BEGIN
    WRITE(1. / 2. * 3.)
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), '1.5', '1 / 2 * 3 = 1.5.');
    test.end();
});

tape('Basic Math with Variable.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
  VARIABLE v: INTEGER;
  BEGIN
    v := 5 - 3 * 7 + 8;
    WRITE(v)
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), '-8', '5 - 3 * 7 + 8 = -8');
    test.end();
});

tape('Use basic constant.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } Expr;
CONSTANT hello = "Hello";
BEGIN
  WRITE(hello)
END Expr;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(outputCapture.getOutput(), 'Hello', 'Output constant hello');
    test.end();
});

tape('Simple Hello World Messages.', async (test) => {
    const code = `INTERFACE HelloWorld;
  { IN Hello(hello: TEXT) OUT World(world: TEXT) } IN Bye
END HelloWorld;

COMPONENT CompHelloWorld OFFERS HelloWorld;
  CONSTANT world = "World"; 
  VARIABLE input: TEXT;
  IMPLEMENTATION HelloWorld;
    BEGIN
      WRITE("Waiting for input.");
      WHILE ?Hello DO
        ?Hello(input);
        WRITE("Server Received\\n");
        WRITE(input);
        WRITE("Server Sending\\n");
        !World(world)
      END
  END HelloWorld;
  BEGIN
    WRITE("Hello World Starting\\n")
  FINALLY
    WRITE("Goodbye Hello World\\n")
END CompHelloWorld;

COMPONENT CompSender REQUIRES HelloWorld;
  VARIABLE world: TEXT; i: INTEGER;
  ACTIVITY
    WRITE("Starting Sender\\n");
    FOR i := 1 TO 10 DO
      WRITE("Client Sending.\\n");
      HelloWorld!Hello("Hello");
      WRITE("Client Receiving.\\n");
      HelloWorld?World(world);
      WRITE(world)
    END;
    HelloWorld!Bye
END CompSender;

COMPONENT { ENTRYPOINT } Connector;
  VARIABLE helloWorld: CompHelloWorld; sender: CompSender;
  BEGIN
    WRITE("STARTING CONNECTOR\\n");
    NEW(helloWorld);
    NEW(sender);
    CONNECT(HelloWorld(helloWorld), sender);
    DELETE(helloWorld);
    DELETE(sender)
END Connector;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(
        outputCapture.getOutput(),
        'STARTING CONNECTOR\nHello World Starting\nGoodbye Hello World\nStarting Sender\nWaiting for input.Client Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorldClient Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorldClient Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorldClient Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorldClient Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorldClient Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorldClient Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorldClient Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorldClient Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorldClient Sending.\nClient Receiving.\nServer Received\nHelloServer Sending\nWorld',
        'Output constant hello',
    );
    test.end();
});

tape('Use basic constant.', async (test) => {
    const code = `COMPONENT { ENTRYPOINT } ProducerConsumer;
CONSTANT
    N = 3; (* producers *)
    M = 2; (* consumers *)
    K = 100; (* original: 1000000; (* amount per producer *)
    C = 10; (* buffer capacity *)
    Output = TRUE; (* original: FALSE; *)

COMPONENT Producer REQUIRES DataAcceptor;
    VARIABLE i: INTEGER;
    ACTIVITY
        FOR i := 1 TO K DO
            DataAcceptor!Element(i)
        END;
        DataAcceptor!Finished
END Producer;

COMPONENT Consumer REQUIRES DataSource;
    VARIABLE x: INTEGER;
    ACTIVITY
        WHILE DataSource?Element DO
            DataSource?Element(x);
            IF Output AND (x MOD (K DIV 10) = 0) THEN WRITE(x); WRITELINE END
        END;
        DataSource?Finished
END Consumer;

INTERFACE DataAcceptor;
    { IN Element(x: INTEGER) } IN Finished
END DataAcceptor;

INTERFACE DataSource;
    { OUT Element(x: INTEGER) } OUT Finished
END DataSource;

COMPONENT BoundedBuffer OFFERS DataAcceptor, DataSource;
    VARIABLE
        a[position: INTEGER]: INTEGER {ARRAY};
        first, last: INTEGER;
        nofProducers: INTEGER;

    IMPLEMENTATION DataAcceptor;
        BEGIN
            WHILE ?Element DO {EXCLUSIVE}
                AWAIT(last-first < C);
                ?Element(a[last MOD C]); INC(last)
            END;
            ?Finished;
            BEGIN {EXCLUSIVE} DEC(nofProducers) END
    END DataAcceptor;

    IMPLEMENTATION DataSource;
        VARIABLE stop: BOOLEAN;
        BEGIN
            stop := FALSE;
            REPEAT {EXCLUSIVE}
                AWAIT((first < last) OR (nofProducers = 0));
                IF first < last THEN
                    !Element(a[first MOD C]); INC(first)
                ELSE stop := TRUE
                END
            UNTIL stop;
            !Finished
    END DataSource;

    BEGIN
        first := 0; last := 0; nofProducers := N
END BoundedBuffer;

VARIABLE
    buffer: BoundedBuffer;
    producer[number: INTEGER]: Producer;
    consumer[number: INTEGER]: Consumer;
    i: INTEGER;
BEGIN
    WRITE(N); WRITE(" producers "); WRITE(M); WRITE(" consumers"); WRITELINE;
    NEW(buffer);
    FOR i := 1 TO N DO
        NEW(producer[i]); CONNECT(DataAcceptor(producer[i]), buffer)
    END;
    FOR i := 1 TO M DO
        NEW(consumer[i]); CONNECT(DataSource(consumer[i]), buffer)
    END;
    FOR i := 1 TO M DO DELETE(consumer[i]) END;
    WRITE("Done"); WRITELINE
END ProducerConsumer;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = compiler.compile(uri, code);
    Runtime.instance().reset();
    const runtime = Runtime.instance();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.run(il);
    test.equal(
        outputCapture.getOutput(),
        '3 producers 2 consumers\nDone\n10\n10\n20\n20\n30\n30\n40\n40\n50\n50\n60\n60\n70\n70\n80\n80\n90\n90\n100\n100\n10\n20\n30\n40\n50\n60\n70\n80\n90\n100\n',
        'Output constant hello',
    );
    test.end();
});
