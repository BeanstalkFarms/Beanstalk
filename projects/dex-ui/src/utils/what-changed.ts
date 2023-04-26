// @ts-nocheck

/**
 * This is a dev only component useful in showing what changed in a React
 * dependency array that triggered a render
 */
type AnyObject = Array<any> | Record<string, any>;
type Diffs = Array<{
  path: string;
  oldValue: any;
  newValue: any;
}>;

/** is pojo or array */
function isObj(obj: any) {
  return typeof obj === "object" && obj !== null;
}

/**
 * compares a react dependencies list with its previous values (from previous cycle)
 * and prints which dependency is the one that changed
 */
export const reactWhatChanged = function reactWhatChanged(dependencies: AnyObject, verbose: boolean = false, id?: string | number) {
  if (isObj(dependencies)) {
    if (Array.isArray(dependencies)) {
      id = Boolean(id) ? id : dependencies.length;
    } else {
      id = Boolean(id) ? id : Object.keys(dependencies).length;
    }
    const hash = `_ReactWhatChanged_${id}`;

    if (Array.isArray(dependencies)) {
      if (!globalThis[hash]) {
        globalThis[hash] = [];
      }
      const oldValues = globalThis[hash];

      const output: any = {};
      dependencies.forEach((dependencyValue, index) => {
        const changedMsg = Object.is(dependencyValue, oldValues[index]) ? "NO" : "YES";
        if (!verbose) {
          output[index] = { "changed?": changedMsg };
        } else {
          output[index] = {
            "changed?": changedMsg,
            "old value": oldValues[index],
            "new value": dependencyValue
          };
        }
      });

      console.table(output);

      // save reference for next iteration
      globalThis[hash] = dependencies;

      return dependencies;
    } else {
      // is object (pojo)
      if (!globalThis[hash]) {
        globalThis[hash] = {};
      }
      const oldValues = globalThis[hash];

      const dependenciesArray: any[] = [];
      const output: any = {};
      Object.entries(dependencies).forEach(([dependencyName, dependencyValue]) => {
        const changedMsg = Object.is(dependencyValue, oldValues[dependencyName]) ? "NO" : "YES";
        if (!verbose) {
          output[dependencyName] = { "changed?": changedMsg };
        } else {
          output[dependencyName] = {
            "changed?": changedMsg,
            "old value": oldValues[dependencyName],
            "new value": dependencyValue
          };
        }

        dependenciesArray.push(dependencyValue);
      });

      console.table(output);

      // save reference for next iteration
      globalThis[hash] = dependencies;

      return dependenciesArray;
    }
  } else {
    console.error("dependencies is not an array nor an object");
    return [];
  }
};

function diffsPush(diffs: Diffs, path: string, oldValue: any, newValue: any) {
  diffs.push({
    path,
    oldValue: isObj(oldValue) ? JSON.stringify(oldValue) : oldValue,
    newValue: isObj(newValue) ? JSON.stringify(newValue) : newValue
  });
}

function recursiveDiff(obj: AnyObject, prevObj: AnyObject, path = "", diffs: Diffs = []) {
  const bothArrays = Array.isArray(obj) && Array.isArray(prevObj);
  const bothPojos = !Array.isArray(obj) && !Array.isArray(prevObj);

  if (bothArrays) {
    const size = Math.max(obj.length, prevObj.length);
    for (let i = 0; i < size; i++) {
      const currPath = `${path}[${i}]`;

      if (isObj(obj[i]) && isObj(prevObj[i])) {
        recursiveDiff(obj[i], prevObj[i], currPath, diffs);
      } else if (obj[i] !== prevObj[i]) {
        diffsPush(diffs, currPath, prevObj[i], obj[i]);
      }
    }
  } else if (bothPojos) {
    const objKeys = Object.keys(obj);
    const prevObjKeys = Object.keys(prevObj);
    const allKeys = [...new Set(objKeys.concat(prevObjKeys))];

    for (const key of allKeys) {
      const currPath = `${path}.${key}`;

      if (isObj(obj[key]) && isObj(prevObj[key])) {
        recursiveDiff(obj[key], prevObj[key], currPath, diffs);
      } else if (obj[key] !== prevObj[key]) {
        diffsPush(diffs, currPath, prevObj[key], obj[key]);
      }
    }
  } else {
    // one is pojo and the other is array
    diffsPush(diffs, path, prevObj, obj);
  }

  return diffs;
}

/**
 * compare (deep comparison) an object/array with its previous value from react's last cycle
 * and print a detailed list of all property changes
 */
export const reactWhatDiff = function reactWhatDiff(obj: AnyObject, id?: string | number) {
  if (isObj(obj)) {
    if (Array.isArray(obj)) {
      id = Boolean(id) ? id : obj.length;
    } else {
      id = Boolean(id) ? id : Object.keys(obj).join("");
    }
    const hash = `_ReactWhatDiff_${id}`;
    let diffs: Diffs = [];
    const prevObj: AnyObject | undefined = globalThis[hash];

    if (typeof prevObj !== "undefined") {
      if (isObj(prevObj)) {
        diffs = recursiveDiff(obj, prevObj);
      }

      if (diffs.length > 0) {
        const output: any = {};
        for (const diff of diffs) {
          output[diff.path] = {
            "old value": diff.oldValue,
            "new value": diff.newValue
          };
        }
        console.table(diffs);
      } else {
        console.log("no differences were found");
      }
    }

    // save reference for next iteration
    globalThis[hash] = obj;

    if (this?.debug) {
      return diffs;
    }
  } else {
    console.error("can not show diffs on a primitive");
  }

  return obj;
};

/**
 * compare (deep comparison) two objects/arrays
 * and print a detailed list of all property changes
 */
export const whatDiff = function whatDiff(newObj: AnyObject, prevObj: AnyObject) {
  const id = "$WhatDiff$";
  const hash = `_ReactWhatDiff_${id}`;

  // save reference of the prev object
  globalThis[hash] = prevObj;

  return reactWhatDiff(newObj, id);
};
