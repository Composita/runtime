import { default as tape } from 'tape';

import { Runtime } from '../src/runtime';
import { Lexer } from '@composita/lexer';
import { CompilerDiagnosis } from '@composita/diagnosis';
import { Parser } from '@composita/parser';
import { Checker } from '@composita/checker';
import { Generator } from '@composita/generator';

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
    WRITE("Hello World"); WRITELINE;
END HelloWorld;`;
    const outputCapture = new OutputCapture();
    const lexer = new Lexer(new CompilerDiagnosis(), '', code);
    const parser = new Parser(lexer);
    const checker = new Checker();
    const symbols = await checker.check(await parser.parse());
    const generator = new Generator();
    const il = await generator.generate(symbols);
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), 'Hello World\n', 'Hello World Complete.');
    test.end();
});

tape('Runtime.getInstance() Double Hello World', async (test) => {
    const outputCapture = new OutputCapture();
    Runtime.getInstance().reset();
    Runtime.getInstance().changeOutput(outputCapture.capture.bind(outputCapture));
    const code = `COMPONENT HelloWorld;
  BEGIN
    WRITE("Hello World"); WRITELINE;
END HelloWorld;

COMPONENT HelloWorld2;
  BEGIN
    WRITE("Hello World\n");
END HelloWorld2;`;
    const lexer = new Lexer(new CompilerDiagnosis(), '', code);
    const parser = new Parser(lexer);
    const checker = new Checker();
    const symbols = await checker.check(await parser.parse());
    const generator = new Generator();
    const il = await generator.generate(symbols);
    await Runtime.getInstance().execute(il);
    test.equal(outputCapture.getOutput(), 'Hello WorldHello World\n\n', 'Hello World Complete.');
    test.end();
});
