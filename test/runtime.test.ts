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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
    test.equal(
        outputCapture.getOutput(),
        '1FINALLY1a2b3c4d5e6f7OHD89Hello World\nFINALLY',
        'NEW Hello World Complete.',
    );
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
    test.equal(outputCapture.getOutput(), '0', '1 + 10 - 11 = 0.');
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
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
    const il = await compiler.compile(uri, code);
    const runtime = new Runtime();
    runtime.changeOutput(outputCapture.capture.bind(outputCapture));
    await runtime.execute(il);
    test.equal(outputCapture.getOutput(), '-8', '5 - 3 * 7 + 8 = -8');
    test.end();
});
