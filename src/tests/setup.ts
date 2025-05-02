import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

globalThis.window.indexedDB = new IDBFactory();