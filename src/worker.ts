//import { parentPort, workerData } from 'worker_threads';
import { Runtime } from './runtime';

const runtime = Runtime.getInstance();
runtime.run();
