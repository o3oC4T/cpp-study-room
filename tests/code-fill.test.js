import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesCodeLine} from '../src/code-fill.js';
import {matrixWalkthrough} from '../src/matrix-walkthrough.js';

test('code blanks allow whitespace without merging C++ identifiers or dropping array deletion',()=>{
 const fields=matrixWalkthrough.exercise.fields;
 assert.equal(matchesCodeLine('int **matrix = new\tint * [ rows ] ;',fields[0].answers),true);
 assert.equal(matchesCodeLine('int**matrix=newint*[rows];',fields[0].answers),false);
 assert.equal(matchesCodeLine('int** matrix = new int[rows];',fields[0].answers),false);
 assert.equal(matchesCodeLine('matrix[i] = new int[rows];',fields[1].answers),false);
 assert.equal(matchesCodeLine('*(matrix+i)=new int[cols];',fields[1].answers),true);
 assert.equal(matchesCodeLine('delete [ ] matrix [ i ] ;',fields[2].answers),true);
 assert.equal(matchesCodeLine('delete matrix[i];',fields[2].answers),false);
 assert.equal(matchesCodeLine('delete[] matrix[i];',fields[3].answers),false);
 assert.equal(matchesCodeLine('delete[] matrix',fields[3].answers),false);
});
