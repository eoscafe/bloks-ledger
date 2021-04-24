/********************************************************************************
 *   Ledger Node JS API
 *   (c) 2016-2017 Ledger
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ********************************************************************************/

export function splitPath(path: any) {
  let result: any = [];
  let components: string[] = path.split("/");

  for (const element of components) {
    let number = parseInt(element, 10);
    if (isNaN(number)) continue
    if (element.length > 1 && element[element.length - 1] === "'") {
      number += 0x80000000;
    }
    result.push(number)
  }

  return result;
}

export function foreach(arr: any, callback: any) {
  function iterate(index: any, array: any, result: any) {
    if (index >= array.length) {
      return result;
    } else return callback(array[index], index).then(function (res: any) {
      result.push(res);
      return iterate(index + 1, array, result);
    });
  }
  return Promise.resolve().then(() => iterate(0, arr, []));
}