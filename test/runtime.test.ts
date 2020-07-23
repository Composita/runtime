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

tape('Runtime.getInstance() Hello World', async (test) => {
    const code = `COMPONENT HelloWorld;
  BEGIN
    WRITE("Hello World"); WRITELINE
END HelloWorld;`;
    const outputCapture = new OutputCapture();
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), 'Hello World\n', 'Hello World Complete.');
    test.end();
});

tape('Runtime.getInstance() Double Hello World', async (test) => {
    const code = `COMPONENT HelloWorld;
  BEGIN
    WRITE("Hello World"); WRITELINE
END HelloWorld;

COMPONENT HelloWorld2;
  BEGIN
    WRITE("Hello World\n")
END HelloWorld2;`;
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), 'Hello WorldHello World\n\n', 'Hello World Complete.');
    test.end();
});

tape('Basic if false comparison.', async (test) => {
    const code = `COMPONENT Expr;
  BEGIN
    IF 2 < 1 + 1 THEN
      WRITE("NOT TRUE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), '', '2 < 1 + 1 false.');
    test.end();
});

tape('Another basic if false comparison.', async (test) => {
    const code = `COMPONENT Expr;
  BEGIN
    IF 1 + 1 < 2 THEN
      WRITE("NOT TRUE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), '', '1 + 1 < 2 false.');
    test.end();
});

tape('Basic if true comparison.', async (test) => {
    const code = `COMPONENT Expr;
  BEGIN
    IF 2 <= 1 + 1 THEN
      WRITE("TRUE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), 'TRUE', '2 <= 1 + 1.');
    test.end();
});

tape('Another basic if true comparison.', async (test) => {
    const code = `COMPONENT Expr;
  BEGIN
    IF 1 + 1 <= 2 THEN
      WRITE("TRUE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), 'TRUE', '1 + 1 <= 2.');
    test.end();
});

tape('Basic Math.', async (test) => {
    const code = `COMPONENT Expr;
  BEGIN
    WRITE(1 + 10 - 11)
END Expr;`;
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), '0', '1 + 10 - 11 = 0.');
    test.end();
});

tape('Another basic comparison.', async (test) => {
    const code = `COMPONENT Expr;
  BEGIN
    IF 1 + 10 < 1 THEN
      WRITE("FALSE")
    END
END Expr;`;
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), '', '1 + 10 < 1 false.');
    test.end();
});

tape('Basic Math.', async (test) => {
    const code = `COMPONENT Expr;
  BEGIN
    WRITE(-1 + 10 - 11)
END Expr;`;
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), '-2', '-2 + 10 - 11 = -2.');
    test.end();
});

tape('Basic Math.', async (test) => {
    const code = `COMPONENT Expr;
  BEGIN
    WRITE(1. / 2. * 3.)
END Expr;`;
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const uri = '';
    const compiler = new Compiler();
    const il = await compiler.compile(uri, code);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), '1.5', '1 / 2 * 3 = 1.5.');
    test.end();
});
