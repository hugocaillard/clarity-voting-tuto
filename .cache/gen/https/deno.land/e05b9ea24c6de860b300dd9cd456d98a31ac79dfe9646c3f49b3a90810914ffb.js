export class Tx {
    type;
    sender;
    contractCall;
    transferStx;
    deployContract;
    constructor(type, sender){
        this.type = type;
        this.sender = sender;
    }
    static transferSTX(amount, recipient, sender) {
        let tx = new Tx(1, sender);
        tx.transferStx = {
            recipient,
            amount
        };
        return tx;
    }
    static contractCall(contract, method, args, sender) {
        let tx = new Tx(2, sender);
        tx.contractCall = {
            contract,
            method,
            args
        };
        return tx;
    }
    static deployContract(name, code, sender) {
        let tx = new Tx(3, sender);
        tx.deployContract = {
            name,
            code
        };
        return tx;
    }
}
export class Chain {
    sessionId;
    blockHeight = 1;
    constructor(sessionId){
        this.sessionId = sessionId;
    }
    mineBlock(transactions) {
        let result = JSON.parse(Deno.core.opSync("api/v1/mine_block", {
            sessionId: this.sessionId,
            transactions: transactions
        }));
        this.blockHeight = result.block_height;
        let block = {
            height: result.block_height,
            receipts: result.receipts
        };
        return block;
    }
    mineEmptyBlock(count) {
        let result = JSON.parse(Deno.core.opSync("api/v1/mine_empty_blocks", {
            sessionId: this.sessionId,
            count: count
        }));
        this.blockHeight = result.block_height;
        let emptyBlock = {
            session_id: result.session_id,
            block_height: result.block_height
        };
        return emptyBlock;
    }
    mineEmptyBlockUntil(targetBlockHeight) {
        let count = targetBlockHeight - this.blockHeight;
        if (count < 0) {
            throw new Error(`Chain tip cannot be moved from ${this.blockHeight} to ${targetBlockHeight}`);
        }
        return this.mineEmptyBlock(count);
    }
    callReadOnlyFn(contract, method, args, sender) {
        let result = JSON.parse(Deno.core.opSync("api/v1/call_read_only_fn", {
            sessionId: this.sessionId,
            contract: contract,
            method: method,
            args: args,
            sender: sender
        }));
        let readOnlyFn = {
            session_id: result.session_id,
            result: result.result,
            events: result.events
        };
        return readOnlyFn;
    }
    getAssetsMaps() {
        let result = JSON.parse(Deno.core.opSync("api/v1/get_assets_maps", {
            sessionId: this.sessionId
        }));
        let assetsMaps = {
            session_id: result.session_id,
            assets: result.assets
        };
        return assetsMaps;
    }
}
export class Clarinet {
    static test(options) {
        Deno.test({
            name: options.name,
            only: options.only,
            ignore: options.ignore,
            async fn () {
                Deno.core.ops();
                let hasPreDeploymentSteps = options.preDeployment !== undefined;
                let result = JSON.parse(Deno.core.opSync("api/v1/new_session", {
                    name: options.name,
                    loadDeployment: !hasPreDeploymentSteps,
                    deploymentPath: options.deploymentPath
                }));
                if (options.preDeployment) {
                    let chain = new Chain(result["session_id"]);
                    let accounts = new Map();
                    for (let account of result["accounts"]){
                        accounts.set(account.name, account);
                    }
                    await options.preDeployment(chain, accounts);
                    result = JSON.parse(Deno.core.opSync("api/v1/load_deployment", {
                        sessionId: chain.sessionId,
                        deploymentPath: options.deploymentPath
                    }));
                }
                let chain1 = new Chain(result["session_id"]);
                let accounts1 = new Map();
                for (let account1 of result["accounts"]){
                    accounts1.set(account1.name, account1);
                }
                let contracts = new Map();
                for (let contract of result["contracts"]){
                    contracts.set(contract.contract_id, contract);
                }
                await options.fn(chain1, accounts1, contracts);
                JSON.parse(Deno.core.opSync("api/v1/terminate_session", {
                    sessionId: chain1.sessionId
                }));
            }
        });
    }
    static run(options) {
        Deno.test({
            name: "running script",
            async fn () {
                Deno.core.ops();
                let result = JSON.parse(Deno.core.opSync("api/v1/new_session", {
                    name: "running script",
                    loadDeployment: true,
                    deploymentPath: undefined
                }));
                let accounts = new Map();
                for (let account of result["accounts"]){
                    accounts.set(account.name, account);
                }
                let contracts = new Map();
                for (let contract of result["contracts"]){
                    contracts.set(contract.contract_id, contract);
                }
                let stacks_node = {
                    url: result["stacks_node_url"]
                };
                await options.fn(accounts, contracts, stacks_node);
            }
        });
    }
}
export var types;
(function(types) {
    const byteToHex = [];
    for(let n = 0; n <= 0xff; ++n){
        const hexOctet = n.toString(16).padStart(2, "0");
        byteToHex.push(hexOctet);
    }
    function serializeTuple(input) {
        let items = [];
        for (var [key, value] of Object.entries(input)){
            if (typeof value === "object") {
                items.push(`${key}: { ${serializeTuple(value)} }`);
            } else if (Array.isArray(value)) {
            // todo(ludo): not supported, should panic
            } else {
                items.push(`${key}: ${value}`);
            }
        }
        return items.join(", ");
    }
    function isObject(obj) {
        return typeof obj === "object" && !Array.isArray(obj);
    }
    function ok(val) {
        return `(ok ${val})`;
    }
    types.ok = ok;
    function err(val) {
        return `(err ${val})`;
    }
    types.err = err;
    function some(val) {
        return `(some ${val})`;
    }
    types.some = some;
    function none() {
        return `none`;
    }
    types.none = none;
    function bool(val) {
        return `${val}`;
    }
    types.bool = bool;
    function int(val) {
        return `${val}`;
    }
    types.int = int;
    function uint(val) {
        return `u${val}`;
    }
    types.uint = uint;
    function ascii(val) {
        return JSON.stringify(val);
    }
    types.ascii = ascii;
    function utf8(val) {
        return `u${JSON.stringify(val)}`;
    }
    types.utf8 = utf8;
    function buff(val) {
        const buff = typeof val == "string" ? new TextEncoder().encode(val) : new Uint8Array(val);
        const hexOctets = new Array(buff.length);
        for(let i = 0; i < buff.length; ++i){
            hexOctets[i] = byteToHex[buff[i]];
        }
        return `0x${hexOctets.join("")}`;
    }
    types.buff = buff;
    function list(val) {
        return `(list ${val.join(" ")})`;
    }
    types.list = list;
    function principal(val) {
        return `'${val}`;
    }
    types.principal = principal;
    function tuple(val) {
        return `{ ${serializeTuple(val)} }`;
    }
    types.tuple = tuple;
})(types || (types = {}));
function consume(src, expectation, wrapped) {
    let dst = (" " + src).slice(1);
    let size = expectation.length;
    if (!wrapped && src !== expectation) {
        throw new Error(`Expected ${green(expectation.toString())}, got ${red(src.toString())}`);
    }
    if (wrapped) {
        size += 2;
    }
    if (dst.length < size) {
        throw new Error(`Expected ${green(expectation.toString())}, got ${red(src.toString())}`);
    }
    if (wrapped) {
        dst = dst.substring(1, dst.length - 1);
    }
    let res = dst.slice(0, expectation.length);
    if (res !== expectation) {
        throw new Error(`Expected ${green(expectation.toString())}, got ${red(src.toString())}`);
    }
    let leftPad = 0;
    if (dst.charAt(expectation.length) === " ") {
        leftPad = 1;
    }
    let remainder = dst.substring(expectation.length + leftPad);
    return remainder;
}
String.prototype.expectOk = function() {
    return consume(this, "ok", true);
};
String.prototype.expectErr = function() {
    return consume(this, "err", true);
};
String.prototype.expectSome = function() {
    return consume(this, "some", true);
};
String.prototype.expectNone = function() {
    return consume(this, "none", false);
};
String.prototype.expectBool = function(value) {
    try {
        consume(this, `${value}`, false);
    } catch (error) {
        throw error;
    }
    return value;
};
String.prototype.expectUint = function(value) {
    try {
        consume(this, `u${value}`, false);
    } catch (error) {
        throw error;
    }
    return BigInt(value);
};
String.prototype.expectInt = function(value) {
    try {
        consume(this, `${value}`, false);
    } catch (error) {
        throw error;
    }
    return BigInt(value);
};
String.prototype.expectBuff = function(value) {
    let buffer = types.buff(value);
    if (this !== buffer) {
        throw new Error(`Expected ${green(buffer)}, got ${red(this.toString())}`);
    }
    return value;
};
String.prototype.expectAscii = function(value) {
    try {
        consume(this, `"${value}"`, false);
    } catch (error) {
        throw error;
    }
    return value;
};
String.prototype.expectUtf8 = function(value) {
    try {
        consume(this, `u"${value}"`, false);
    } catch (error) {
        throw error;
    }
    return value;
};
String.prototype.expectPrincipal = function(value) {
    try {
        consume(this, `${value}`, false);
    } catch (error) {
        throw error;
    }
    return value;
};
String.prototype.expectList = function() {
    if (this.charAt(0) !== "[" || this.charAt(this.length - 1) !== "]") {
        throw new Error(`Expected ${green("(list ...)")}, got ${red(this.toString())}`);
    }
    let stack = [];
    let elements = [];
    let start = 1;
    for(var i = 0; i < this.length; i++){
        if (this.charAt(i) === "," && stack.length == 1) {
            elements.push(this.substring(start, i));
            start = i + 2;
        }
        if ([
            "(",
            "[",
            "{"
        ].includes(this.charAt(i))) {
            stack.push(this.charAt(i));
        }
        if (this.charAt(i) === ")" && stack[stack.length - 1] === "(") {
            stack.pop();
        }
        if (this.charAt(i) === "}" && stack[stack.length - 1] === "{") {
            stack.pop();
        }
        if (this.charAt(i) === "]" && stack[stack.length - 1] === "[") {
            stack.pop();
        }
    }
    let remainder = this.substring(start, this.length - 1);
    if (remainder.length > 0) {
        elements.push(remainder);
    }
    return elements;
};
String.prototype.expectTuple = function() {
    if (this.charAt(0) !== "{" || this.charAt(this.length - 1) !== "}") {
        throw new Error(`Expected ${green("(tuple ...)")}, got ${red(this.toString())}`);
    }
    let start = 1;
    let stack = [];
    let elements = [];
    for(var i = 0; i < this.length; i++){
        if (this.charAt(i) === "," && stack.length == 1) {
            elements.push(this.substring(start, i));
            start = i + 2;
        }
        if ([
            "(",
            "[",
            "{"
        ].includes(this.charAt(i))) {
            stack.push(this.charAt(i));
        }
        if (this.charAt(i) === ")" && stack[stack.length - 1] === "(") {
            stack.pop();
        }
        if (this.charAt(i) === "}" && stack[stack.length - 1] === "{") {
            stack.pop();
        }
        if (this.charAt(i) === "]" && stack[stack.length - 1] === "[") {
            stack.pop();
        }
    }
    let remainder = this.substring(start, this.length - 1);
    if (remainder.length > 0) {
        elements.push(remainder);
    }
    let tuple = {};
    for (let element of elements){
        for(var i = 0; i < element.length; i++){
            if (element.charAt(i) === ":") {
                let key = element.substring(0, i);
                let value = element.substring(i + 2, element.length);
                tuple[key] = value;
                break;
            }
        }
    }
    return tuple;
};
Array.prototype.expectSTXTransferEvent = function(amount, sender, recipient) {
    for (let event of this){
        try {
            let e = {};
            e["amount"] = event.stx_transfer_event.amount.expectInt(amount);
            e["sender"] = event.stx_transfer_event.sender.expectPrincipal(sender);
            e["recipient"] = event.stx_transfer_event.recipient.expectPrincipal(recipient);
            return e;
        } catch (error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected STXTransferEvent`);
};
Array.prototype.expectFungibleTokenTransferEvent = function(amount, sender, recipient, assetId) {
    for (let event of this){
        try {
            let e = {};
            e["amount"] = event.ft_transfer_event.amount.expectInt(amount);
            e["sender"] = event.ft_transfer_event.sender.expectPrincipal(sender);
            e["recipient"] = event.ft_transfer_event.recipient.expectPrincipal(recipient);
            if (event.ft_transfer_event.asset_identifier.endsWith(assetId)) {
                e["assetId"] = event.ft_transfer_event.asset_identifier;
            } else {
                continue;
            }
            return e;
        } catch (error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected FungibleTokenTransferEvent(${amount}, ${sender}, ${recipient}, ${assetId})\n${JSON.stringify(this)}`);
};
Array.prototype.expectFungibleTokenMintEvent = function(amount, recipient, assetId) {
    for (let event of this){
        try {
            let e = {};
            e["amount"] = event.ft_mint_event.amount.expectInt(amount);
            e["recipient"] = event.ft_mint_event.recipient.expectPrincipal(recipient);
            if (event.ft_mint_event.asset_identifier.endsWith(assetId)) {
                e["assetId"] = event.ft_mint_event.asset_identifier;
            } else {
                continue;
            }
            return e;
        } catch (error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected FungibleTokenMintEvent`);
};
Array.prototype.expectFungibleTokenBurnEvent = function(amount, sender, assetId) {
    for (let event of this){
        try {
            let e = {};
            e["amount"] = event.ft_burn_event.amount.expectInt(amount);
            e["sender"] = event.ft_burn_event.sender.expectPrincipal(sender);
            if (event.ft_burn_event.asset_identifier.endsWith(assetId)) {
                e["assetId"] = event.ft_burn_event.asset_identifier;
            } else {
                continue;
            }
            return e;
        } catch (error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected FungibleTokenBurnEvent`);
};
Array.prototype.expectPrintEvent = function(contract_identifier, value) {
    for (let event of this){
        try {
            let e = {};
            e["contract_identifier"] = event.contract_event.contract_identifier.expectPrincipal(contract_identifier);
            if (event.contract_event.topic.endsWith("print")) {
                e["topic"] = event.contract_event.topic;
            } else {
                continue;
            }
            if (event.contract_event.value.endsWith(value)) {
                e["value"] = event.contract_event.value;
            } else {
                continue;
            }
            return e;
        } catch (error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected PrintEvent`);
};
// Array.prototype.expectEvent = function(sel: (e: Object) => Object) {
//     for (let event of this) {
//         try {
//             sel(event);
//             return event as Object;
//         } catch (error) {
//             continue;
//         }
//     }
//     throw new Error(`Unable to retrieve expected PrintEvent`);
// }
Array.prototype.expectNonFungibleTokenTransferEvent = function(tokenId, sender, recipient, assetAddress, assetId) {
    for (let event of this){
        try {
            let e = {};
            if (event.nft_transfer_event.value === tokenId) {
                e["tokenId"] = event.nft_transfer_event.value;
            } else {
                continue;
            }
            e["sender"] = event.nft_transfer_event.sender.expectPrincipal(sender);
            e["recipient"] = event.nft_transfer_event.recipient.expectPrincipal(recipient);
            if (event.nft_transfer_event.asset_identifier === `${assetAddress}::${assetId}`) {
                e["assetId"] = event.nft_transfer_event.asset_identifier;
            } else {
                continue;
            }
            return e;
        } catch (error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected NonFungibleTokenTransferEvent`);
};
Array.prototype.expectNonFungibleTokenMintEvent = function(tokenId, recipient, assetAddress, assetId) {
    for (let event of this){
        try {
            let e = {};
            if (event.nft_mint_event.value === tokenId) {
                e["tokenId"] = event.nft_mint_event.value;
            } else {
                continue;
            }
            e["recipient"] = event.nft_mint_event.recipient.expectPrincipal(recipient);
            if (event.nft_mint_event.asset_identifier === `${assetAddress}::${assetId}`) {
                e["assetId"] = event.nft_mint_event.asset_identifier;
            } else {
                continue;
            }
            return e;
        } catch (error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected NonFungibleTokenMintEvent`);
};
Array.prototype.expectNonFungibleTokenBurnEvent = function(tokenId, sender, assetAddress, assetId) {
    for (let event of this){
        try {
            let e = {};
            if (event.nft_burn_event.value === tokenId) {
                e["tokenId"] = event.nft_burn_event.value;
            } else {
                continue;
            }
            e["sender"] = event.nft_burn_event.sender.expectPrincipal(sender);
            if (event.nft_burn_event.asset_identifier === `${assetAddress}::${assetId}`) {
                e["assetId"] = event.nft_burn_event.asset_identifier;
            } else {
                continue;
            }
            return e;
        } catch (error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected NonFungibleTokenBurnEvent`);
};
const noColor = globalThis.Deno?.noColor ?? true;
let enabled = !noColor;
function code(open, close) {
    return {
        open: `\x1b[${open.join(";")}m`,
        close: `\x1b[${close}m`,
        regexp: new RegExp(`\\x1b\\[${close}m`, "g")
    };
}
function run(str, code) {
    return enabled ? `${code.open}${str.replace(code.regexp, code.open)}${code.close}` : str;
}
export function red(str) {
    return run(str, code([
        31
    ], 39));
}
export function green(str) {
    return run(str, code([
        32
    ], 39));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvY2xhcmluZXRAdjEuMC4wL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjbGFzcyBUeCB7XG4gICAgdHlwZTogbnVtYmVyO1xuICAgIHNlbmRlcjogc3RyaW5nO1xuICAgIGNvbnRyYWN0Q2FsbD86IFR4Q29udHJhY3RDYWxsO1xuICAgIHRyYW5zZmVyU3R4PzogVHhUcmFuc2ZlcjtcbiAgICBkZXBsb3lDb250cmFjdD86IFR4RGVwbG95Q29udHJhY3Q7XG4gIFxuICAgIGNvbnN0cnVjdG9yKHR5cGU6IG51bWJlciwgc2VuZGVyOiBzdHJpbmcpIHtcbiAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgICB0aGlzLnNlbmRlciA9IHNlbmRlcjtcbiAgICB9XG4gIFxuICAgIHN0YXRpYyB0cmFuc2ZlclNUWChhbW91bnQ6IG51bWJlciwgcmVjaXBpZW50OiBzdHJpbmcsIHNlbmRlcjogc3RyaW5nKSB7XG4gICAgICBsZXQgdHggPSBuZXcgVHgoMSwgc2VuZGVyKTtcbiAgICAgIHR4LnRyYW5zZmVyU3R4ID0ge1xuICAgICAgICByZWNpcGllbnQsXG4gICAgICAgIGFtb3VudCxcbiAgICAgIH07XG4gICAgICByZXR1cm4gdHg7XG4gICAgfVxuICBcbiAgICBzdGF0aWMgY29udHJhY3RDYWxsKFxuICAgICAgY29udHJhY3Q6IHN0cmluZyxcbiAgICAgIG1ldGhvZDogc3RyaW5nLFxuICAgICAgYXJnczogQXJyYXk8c3RyaW5nPixcbiAgICAgIHNlbmRlcjogc3RyaW5nLFxuICAgICkge1xuICAgICAgbGV0IHR4ID0gbmV3IFR4KDIsIHNlbmRlcik7XG4gICAgICB0eC5jb250cmFjdENhbGwgPSB7XG4gICAgICAgIGNvbnRyYWN0LFxuICAgICAgICBtZXRob2QsXG4gICAgICAgIGFyZ3MsXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHR4O1xuICAgIH1cbiAgXG4gICAgc3RhdGljIGRlcGxveUNvbnRyYWN0KG5hbWU6IHN0cmluZywgY29kZTogc3RyaW5nLCBzZW5kZXI6IHN0cmluZykge1xuICAgICAgbGV0IHR4ID0gbmV3IFR4KDMsIHNlbmRlcik7XG4gICAgICB0eC5kZXBsb3lDb250cmFjdCA9IHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgY29kZSxcbiAgICAgIH07XG4gICAgICByZXR1cm4gdHg7XG4gICAgfVxuICB9XG4gIFxuICBleHBvcnQgaW50ZXJmYWNlIFR4Q29udHJhY3RDYWxsIHtcbiAgICBjb250cmFjdDogc3RyaW5nO1xuICAgIG1ldGhvZDogc3RyaW5nO1xuICAgIGFyZ3M6IEFycmF5PHN0cmluZz47XG4gIH1cbiAgXG4gIGV4cG9ydCBpbnRlcmZhY2UgVHhEZXBsb3lDb250cmFjdCB7XG4gICAgY29kZTogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgfVxuICBcbiAgZXhwb3J0IGludGVyZmFjZSBUeFRyYW5zZmVyIHtcbiAgICBhbW91bnQ6IG51bWJlcjtcbiAgICByZWNpcGllbnQ6IHN0cmluZztcbiAgfVxuICBcbiAgZXhwb3J0IGludGVyZmFjZSBUeFJlY2VpcHQge1xuICAgIHJlc3VsdDogc3RyaW5nO1xuICAgIGV2ZW50czogQXJyYXk8YW55PjtcbiAgfVxuICBcbiAgZXhwb3J0IGludGVyZmFjZSBCbG9jayB7XG4gICAgaGVpZ2h0OiBudW1iZXI7XG4gICAgcmVjZWlwdHM6IEFycmF5PFR4UmVjZWlwdD47XG4gIH1cbiAgXG4gIGV4cG9ydCBpbnRlcmZhY2UgQWNjb3VudCB7XG4gICAgYWRkcmVzczogc3RyaW5nO1xuICAgIGJhbGFuY2U6IG51bWJlcjtcbiAgICBuYW1lOiBzdHJpbmc7XG4gIH1cbiAgXG4gIGV4cG9ydCBpbnRlcmZhY2UgQ2hhaW4ge1xuICAgIHNlc3Npb25JZDogbnVtYmVyO1xuICB9XG4gIFxuICBleHBvcnQgaW50ZXJmYWNlIFJlYWRPbmx5Rm4ge1xuICAgIHNlc3Npb25faWQ6IG51bWJlcjtcbiAgICByZXN1bHQ6IHN0cmluZztcbiAgICBldmVudHM6IEFycmF5PGFueT47XG4gIH1cbiAgXG4gIGV4cG9ydCBpbnRlcmZhY2UgRW1wdHlCbG9jayB7XG4gICAgc2Vzc2lvbl9pZDogbnVtYmVyO1xuICAgIGJsb2NrX2hlaWdodDogbnVtYmVyO1xuICB9XG4gIFxuICBleHBvcnQgaW50ZXJmYWNlIEFzc2V0c01hcHMge1xuICAgIHNlc3Npb25faWQ6IG51bWJlcjtcbiAgICBhc3NldHM6IHtcbiAgICAgIFtuYW1lOiBzdHJpbmddOiB7XG4gICAgICAgIFtvd25lcjogc3RyaW5nXTogbnVtYmVyO1xuICAgICAgfTtcbiAgICB9O1xuICB9XG4gIFxuICBleHBvcnQgY2xhc3MgQ2hhaW4ge1xuICAgIHNlc3Npb25JZDogbnVtYmVyO1xuICAgIGJsb2NrSGVpZ2h0OiBudW1iZXIgPSAxO1xuICBcbiAgICBjb25zdHJ1Y3RvcihzZXNzaW9uSWQ6IG51bWJlcikge1xuICAgICAgdGhpcy5zZXNzaW9uSWQgPSBzZXNzaW9uSWQ7XG4gICAgfVxuICBcbiAgICBtaW5lQmxvY2sodHJhbnNhY3Rpb25zOiBBcnJheTxUeD4pOiBCbG9jayB7XG4gICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZSgoRGVubyBhcyBhbnkpLmNvcmUub3BTeW5jKFwiYXBpL3YxL21pbmVfYmxvY2tcIiwge1xuICAgICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgICAgICB0cmFuc2FjdGlvbnM6IHRyYW5zYWN0aW9ucyxcbiAgICAgIH0pKTtcbiAgICAgIHRoaXMuYmxvY2tIZWlnaHQgPSByZXN1bHQuYmxvY2tfaGVpZ2h0O1xuICAgICAgbGV0IGJsb2NrOiBCbG9jayA9IHtcbiAgICAgICAgaGVpZ2h0OiByZXN1bHQuYmxvY2tfaGVpZ2h0LFxuICAgICAgICByZWNlaXB0czogcmVzdWx0LnJlY2VpcHRzLFxuICAgICAgfTtcbiAgICAgIHJldHVybiBibG9jaztcbiAgICB9XG4gIFxuICAgIG1pbmVFbXB0eUJsb2NrKGNvdW50OiBudW1iZXIpOiBFbXB0eUJsb2NrIHtcbiAgICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgICAoRGVubyBhcyBhbnkpLmNvcmUub3BTeW5jKFwiYXBpL3YxL21pbmVfZW1wdHlfYmxvY2tzXCIsIHtcbiAgICAgICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgICAgICAgIGNvdW50OiBjb3VudCxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgICAgdGhpcy5ibG9ja0hlaWdodCA9IHJlc3VsdC5ibG9ja19oZWlnaHQ7XG4gICAgICBsZXQgZW1wdHlCbG9jazogRW1wdHlCbG9jayA9IHtcbiAgICAgICAgc2Vzc2lvbl9pZDogcmVzdWx0LnNlc3Npb25faWQsXG4gICAgICAgIGJsb2NrX2hlaWdodDogcmVzdWx0LmJsb2NrX2hlaWdodCxcbiAgICAgIH07XG4gICAgICByZXR1cm4gZW1wdHlCbG9jaztcbiAgICB9XG4gIFxuICAgIG1pbmVFbXB0eUJsb2NrVW50aWwodGFyZ2V0QmxvY2tIZWlnaHQ6IG51bWJlcik6IEVtcHR5QmxvY2sge1xuICAgICAgbGV0IGNvdW50ID0gdGFyZ2V0QmxvY2tIZWlnaHQgLSB0aGlzLmJsb2NrSGVpZ2h0O1xuICAgICAgaWYgKGNvdW50IDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYENoYWluIHRpcCBjYW5ub3QgYmUgbW92ZWQgZnJvbSAke3RoaXMuYmxvY2tIZWlnaHR9IHRvICR7dGFyZ2V0QmxvY2tIZWlnaHR9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLm1pbmVFbXB0eUJsb2NrKGNvdW50KTtcbiAgICB9XG4gIFxuICAgIGNhbGxSZWFkT25seUZuKFxuICAgICAgY29udHJhY3Q6IHN0cmluZyxcbiAgICAgIG1ldGhvZDogc3RyaW5nLFxuICAgICAgYXJnczogQXJyYXk8YW55PixcbiAgICAgIHNlbmRlcjogc3RyaW5nLFxuICAgICk6IFJlYWRPbmx5Rm4ge1xuICAgICAgbGV0IHJlc3VsdCA9IEpTT04ucGFyc2UoXG4gICAgICAgIChEZW5vIGFzIGFueSkuY29yZS5vcFN5bmMoXCJhcGkvdjEvY2FsbF9yZWFkX29ubHlfZm5cIiwge1xuICAgICAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXG4gICAgICAgICAgY29udHJhY3Q6IGNvbnRyYWN0LFxuICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgIGFyZ3M6IGFyZ3MsXG4gICAgICAgICAgc2VuZGVyOiBzZW5kZXIsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICAgIGxldCByZWFkT25seUZuOiBSZWFkT25seUZuID0ge1xuICAgICAgICBzZXNzaW9uX2lkOiByZXN1bHQuc2Vzc2lvbl9pZCxcbiAgICAgICAgcmVzdWx0OiByZXN1bHQucmVzdWx0LFxuICAgICAgICBldmVudHM6IHJlc3VsdC5ldmVudHMsXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHJlYWRPbmx5Rm47XG4gICAgfVxuICBcbiAgICBnZXRBc3NldHNNYXBzKCk6IEFzc2V0c01hcHMge1xuICAgICAgbGV0IHJlc3VsdCA9IEpTT04ucGFyc2UoXG4gICAgICAgIChEZW5vIGFzIGFueSkuY29yZS5vcFN5bmMoXCJhcGkvdjEvZ2V0X2Fzc2V0c19tYXBzXCIsIHtcbiAgICAgICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgICBsZXQgYXNzZXRzTWFwczogQXNzZXRzTWFwcyA9IHtcbiAgICAgICAgc2Vzc2lvbl9pZDogcmVzdWx0LnNlc3Npb25faWQsXG4gICAgICAgIGFzc2V0czogcmVzdWx0LmFzc2V0cyxcbiAgICAgIH07XG4gICAgICByZXR1cm4gYXNzZXRzTWFwcztcbiAgICB9XG4gIH1cbiAgXG4gIHR5cGUgUHJlRGVwbG95bWVudEZ1bmN0aW9uID0gKFxuICAgIGNoYWluOiBDaGFpbixcbiAgICBhY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD4sXG4gICkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG4gIFxuICB0eXBlIFRlc3RGdW5jdGlvbiA9IChcbiAgICBjaGFpbjogQ2hhaW4sXG4gICAgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+LFxuICAgIGNvbnRyYWN0czogTWFwPHN0cmluZywgQ29udHJhY3Q+LFxuICApID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuICB0eXBlIFByZVNldHVwRnVuY3Rpb24gPSAoKSA9PiBBcnJheTxUeD47XG4gIFxuICBpbnRlcmZhY2UgVW5pdFRlc3RPcHRpb25zIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgb25seT86IHRydWU7XG4gICAgaWdub3JlPzogdHJ1ZTtcbiAgICBkZXBsb3ltZW50UGF0aD86IHN0cmluZztcbiAgICBwcmVEZXBsb3ltZW50PzogUHJlRGVwbG95bWVudEZ1bmN0aW9uO1xuICAgIGZuOiBUZXN0RnVuY3Rpb247XG4gIH1cbiAgXG4gIGV4cG9ydCBpbnRlcmZhY2UgQ29udHJhY3Qge1xuICAgIGNvbnRyYWN0X2lkOiBzdHJpbmc7XG4gICAgc291cmNlOiBzdHJpbmc7XG4gICAgY29udHJhY3RfaW50ZXJmYWNlOiBhbnk7XG4gIH1cbiAgXG4gIGV4cG9ydCBpbnRlcmZhY2UgU3RhY2tzTm9kZSB7XG4gICAgdXJsOiBzdHJpbmc7XG4gIH1cbiAgXG4gIHR5cGUgU2NyaXB0RnVuY3Rpb24gPSAoXG4gICAgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+LFxuICAgIGNvbnRyYWN0czogTWFwPHN0cmluZywgQ29udHJhY3Q+LFxuICAgIG5vZGU6IFN0YWNrc05vZGUsXG4gICkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG4gIFxuICBpbnRlcmZhY2UgU2NyaXB0T3B0aW9ucyB7XG4gICAgZm46IFNjcmlwdEZ1bmN0aW9uO1xuICB9XG4gIFxuICBleHBvcnQgY2xhc3MgQ2xhcmluZXQge1xuICAgIHN0YXRpYyB0ZXN0KG9wdGlvbnM6IFVuaXRUZXN0T3B0aW9ucykge1xuICAgICAgRGVuby50ZXN0KHtcbiAgICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgICBvbmx5OiBvcHRpb25zLm9ubHksXG4gICAgICAgIGlnbm9yZTogb3B0aW9ucy5pZ25vcmUsXG4gICAgICAgIGFzeW5jIGZuKCkge1xuICAgICAgICAgIChEZW5vIGFzIGFueSkuY29yZS5vcHMoKTtcbiAgXG4gICAgICAgICAgbGV0IGhhc1ByZURlcGxveW1lbnRTdGVwcyA9IG9wdGlvbnMucHJlRGVwbG95bWVudCAhPT0gdW5kZWZpbmVkO1xuICBcbiAgICAgICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgICAgICAgIChEZW5vIGFzIGFueSkuY29yZS5vcFN5bmMoXCJhcGkvdjEvbmV3X3Nlc3Npb25cIiwge1xuICAgICAgICAgICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICAgICAgICAgIGxvYWREZXBsb3ltZW50OiAhaGFzUHJlRGVwbG95bWVudFN0ZXBzLFxuICAgICAgICAgICAgICBkZXBsb3ltZW50UGF0aDogb3B0aW9ucy5kZXBsb3ltZW50UGF0aCxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICk7XG4gIFxuICAgICAgICAgIGlmIChvcHRpb25zLnByZURlcGxveW1lbnQpIHtcbiAgICAgICAgICAgIGxldCBjaGFpbiA9IG5ldyBDaGFpbihyZXN1bHRbXCJzZXNzaW9uX2lkXCJdKTtcbiAgICAgICAgICAgIGxldCBhY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD4gPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBhY2NvdW50IG9mIHJlc3VsdFtcImFjY291bnRzXCJdKSB7XG4gICAgICAgICAgICAgIGFjY291bnRzLnNldChhY2NvdW50Lm5hbWUsIGFjY291bnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgb3B0aW9ucy5wcmVEZXBsb3ltZW50KGNoYWluLCBhY2NvdW50cyk7XG4gIFxuICAgICAgICAgICAgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgICAgICAgICAgKERlbm8gYXMgYW55KS5jb3JlLm9wU3luYyhcImFwaS92MS9sb2FkX2RlcGxveW1lbnRcIiwge1xuICAgICAgICAgICAgICAgIHNlc3Npb25JZDogY2hhaW4uc2Vzc2lvbklkLFxuICAgICAgICAgICAgICAgIGRlcGxveW1lbnRQYXRoOiBvcHRpb25zLmRlcGxveW1lbnRQYXRoLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICBcbiAgICAgICAgICBsZXQgY2hhaW4gPSBuZXcgQ2hhaW4ocmVzdWx0W1wic2Vzc2lvbl9pZFwiXSk7XG4gICAgICAgICAgbGV0IGFjY291bnRzOiBNYXA8c3RyaW5nLCBBY2NvdW50PiA9IG5ldyBNYXAoKTtcbiAgICAgICAgICBmb3IgKGxldCBhY2NvdW50IG9mIHJlc3VsdFtcImFjY291bnRzXCJdKSB7XG4gICAgICAgICAgICBhY2NvdW50cy5zZXQoYWNjb3VudC5uYW1lLCBhY2NvdW50KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IGNvbnRyYWN0czogTWFwPHN0cmluZywgQ29udHJhY3Q+ID0gbmV3IE1hcCgpO1xuICAgICAgICAgIGZvciAobGV0IGNvbnRyYWN0IG9mIHJlc3VsdFtcImNvbnRyYWN0c1wiXSkge1xuICAgICAgICAgICAgY29udHJhY3RzLnNldChjb250cmFjdC5jb250cmFjdF9pZCwgY29udHJhY3QpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhd2FpdCBvcHRpb25zLmZuKGNoYWluLCBhY2NvdW50cywgY29udHJhY3RzKTtcbiAgXG4gICAgICAgICAgSlNPTi5wYXJzZSgoRGVubyBhcyBhbnkpLmNvcmUub3BTeW5jKFwiYXBpL3YxL3Rlcm1pbmF0ZV9zZXNzaW9uXCIsIHtcbiAgICAgICAgICAgIHNlc3Npb25JZDogY2hhaW4uc2Vzc2lvbklkLFxuICAgICAgICAgIH0pKTtcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgXG4gICAgc3RhdGljIHJ1bihvcHRpb25zOiBTY3JpcHRPcHRpb25zKSB7XG4gICAgICBEZW5vLnRlc3Qoe1xuICAgICAgICBuYW1lOiBcInJ1bm5pbmcgc2NyaXB0XCIsXG4gICAgICAgIGFzeW5jIGZuKCkge1xuICAgICAgICAgIChEZW5vIGFzIGFueSkuY29yZS5vcHMoKTtcbiAgICAgICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgICAgICAgIChEZW5vIGFzIGFueSkuY29yZS5vcFN5bmMoXCJhcGkvdjEvbmV3X3Nlc3Npb25cIiwge1xuICAgICAgICAgICAgICBuYW1lOiBcInJ1bm5pbmcgc2NyaXB0XCIsXG4gICAgICAgICAgICAgIGxvYWREZXBsb3ltZW50OiB0cnVlLFxuICAgICAgICAgICAgICBkZXBsb3ltZW50UGF0aDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgICBsZXQgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+ID0gbmV3IE1hcCgpO1xuICAgICAgICAgIGZvciAobGV0IGFjY291bnQgb2YgcmVzdWx0W1wiYWNjb3VudHNcIl0pIHtcbiAgICAgICAgICAgIGFjY291bnRzLnNldChhY2NvdW50Lm5hbWUsIGFjY291bnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD4gPSBuZXcgTWFwKCk7XG4gICAgICAgICAgZm9yIChsZXQgY29udHJhY3Qgb2YgcmVzdWx0W1wiY29udHJhY3RzXCJdKSB7XG4gICAgICAgICAgICBjb250cmFjdHMuc2V0KGNvbnRyYWN0LmNvbnRyYWN0X2lkLCBjb250cmFjdCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBzdGFja3Nfbm9kZTogU3RhY2tzTm9kZSA9IHtcbiAgICAgICAgICAgIHVybDogcmVzdWx0W1wic3RhY2tzX25vZGVfdXJsXCJdLFxuICAgICAgICAgIH07XG4gICAgICAgICAgYXdhaXQgb3B0aW9ucy5mbihhY2NvdW50cywgY29udHJhY3RzLCBzdGFja3Nfbm9kZSk7XG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgXG4gIGV4cG9ydCBuYW1lc3BhY2UgdHlwZXMge1xuICAgIGNvbnN0IGJ5dGVUb0hleDogYW55ID0gW107XG4gICAgZm9yIChsZXQgbiA9IDA7IG4gPD0gMHhmZjsgKytuKSB7XG4gICAgICBjb25zdCBoZXhPY3RldCA9IG4udG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsIFwiMFwiKTtcbiAgICAgIGJ5dGVUb0hleC5wdXNoKGhleE9jdGV0KTtcbiAgICB9XG4gIFxuICAgIGZ1bmN0aW9uIHNlcmlhbGl6ZVR1cGxlKGlucHV0OiBPYmplY3QpIHtcbiAgICAgIGxldCBpdGVtczogQXJyYXk8c3RyaW5nPiA9IFtdO1xuICAgICAgZm9yICh2YXIgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGlucHV0KSkge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgaXRlbXMucHVzaChgJHtrZXl9OiB7ICR7c2VyaWFsaXplVHVwbGUodmFsdWUpfSB9YCk7XG4gICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAvLyB0b2RvKGx1ZG8pOiBub3Qgc3VwcG9ydGVkLCBzaG91bGQgcGFuaWNcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpdGVtcy5wdXNoKGAke2tleX06ICR7dmFsdWV9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBpdGVtcy5qb2luKFwiLCBcIik7XG4gICAgfVxuICBcbiAgICBmdW5jdGlvbiBpc09iamVjdChvYmo6IGFueSkge1xuICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09IFwib2JqZWN0XCIgJiYgIUFycmF5LmlzQXJyYXkob2JqKTtcbiAgICB9XG4gIFxuICAgIGV4cG9ydCBmdW5jdGlvbiBvayh2YWw6IHN0cmluZykge1xuICAgICAgcmV0dXJuIGAob2sgJHt2YWx9KWA7XG4gICAgfVxuICBcbiAgICBleHBvcnQgZnVuY3Rpb24gZXJyKHZhbDogc3RyaW5nKSB7XG4gICAgICByZXR1cm4gYChlcnIgJHt2YWx9KWA7XG4gICAgfVxuICBcbiAgICBleHBvcnQgZnVuY3Rpb24gc29tZSh2YWw6IHN0cmluZykge1xuICAgICAgcmV0dXJuIGAoc29tZSAke3ZhbH0pYDtcbiAgICB9XG4gIFxuICAgIGV4cG9ydCBmdW5jdGlvbiBub25lKCkge1xuICAgICAgcmV0dXJuIGBub25lYDtcbiAgICB9XG4gIFxuICAgIGV4cG9ydCBmdW5jdGlvbiBib29sKHZhbDogYm9vbGVhbikge1xuICAgICAgcmV0dXJuIGAke3ZhbH1gO1xuICAgIH1cbiAgXG4gICAgZXhwb3J0IGZ1bmN0aW9uIGludCh2YWw6IG51bWJlciB8IGJpZ2ludCkge1xuICAgICAgcmV0dXJuIGAke3ZhbH1gO1xuICAgIH1cbiAgXG4gICAgZXhwb3J0IGZ1bmN0aW9uIHVpbnQodmFsOiBudW1iZXIgfCBiaWdpbnQpIHtcbiAgICAgIHJldHVybiBgdSR7dmFsfWA7XG4gICAgfVxuICBcbiAgICBleHBvcnQgZnVuY3Rpb24gYXNjaWkodmFsOiBzdHJpbmcpIHtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWwpO1xuICAgIH1cbiAgXG4gICAgZXhwb3J0IGZ1bmN0aW9uIHV0ZjgodmFsOiBzdHJpbmcpIHtcbiAgICAgIHJldHVybiBgdSR7SlNPTi5zdHJpbmdpZnkodmFsKX1gO1xuICAgIH1cbiAgXG4gICAgZXhwb3J0IGZ1bmN0aW9uIGJ1ZmYodmFsOiBBcnJheUJ1ZmZlciB8IHN0cmluZykge1xuICAgICAgY29uc3QgYnVmZiA9IHR5cGVvZiB2YWwgPT0gXCJzdHJpbmdcIlxuICAgICAgICA/IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZSh2YWwpXG4gICAgICAgIDogbmV3IFVpbnQ4QXJyYXkodmFsKTtcbiAgXG4gICAgICBjb25zdCBoZXhPY3RldHMgPSBuZXcgQXJyYXkoYnVmZi5sZW5ndGgpO1xuICBcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYnVmZi5sZW5ndGg7ICsraSkge1xuICAgICAgICBoZXhPY3RldHNbaV0gPSBieXRlVG9IZXhbYnVmZltpXV07XG4gICAgICB9XG4gIFxuICAgICAgcmV0dXJuIGAweCR7aGV4T2N0ZXRzLmpvaW4oXCJcIil9YDtcbiAgICB9XG4gIFxuICAgIGV4cG9ydCBmdW5jdGlvbiBsaXN0KHZhbDogQXJyYXk8YW55Pikge1xuICAgICAgcmV0dXJuIGAobGlzdCAke3ZhbC5qb2luKFwiIFwiKX0pYDtcbiAgICB9XG4gIFxuICAgIGV4cG9ydCBmdW5jdGlvbiBwcmluY2lwYWwodmFsOiBzdHJpbmcpIHtcbiAgICAgIHJldHVybiBgJyR7dmFsfWA7XG4gICAgfVxuICBcbiAgICBleHBvcnQgZnVuY3Rpb24gdHVwbGUodmFsOiBPYmplY3QpIHtcbiAgICAgIHJldHVybiBgeyAke3NlcmlhbGl6ZVR1cGxlKHZhbCl9IH1gO1xuICAgIH1cbiAgfVxuICBcbiAgZGVjbGFyZSBnbG9iYWwge1xuICAgIGludGVyZmFjZSBTdHJpbmcge1xuICAgICAgZXhwZWN0T2soKTogU3RyaW5nO1xuICAgICAgZXhwZWN0RXJyKCk6IFN0cmluZztcbiAgICAgIGV4cGVjdFNvbWUoKTogU3RyaW5nO1xuICAgICAgZXhwZWN0Tm9uZSgpOiB2b2lkO1xuICAgICAgZXhwZWN0Qm9vbCh2YWx1ZTogYm9vbGVhbik6IGJvb2xlYW47XG4gICAgICBleHBlY3RVaW50KHZhbHVlOiBudW1iZXIgfCBiaWdpbnQpOiBiaWdpbnQ7XG4gICAgICBleHBlY3RJbnQodmFsdWU6IG51bWJlciB8IGJpZ2ludCk6IGJpZ2ludDtcbiAgICAgIGV4cGVjdEJ1ZmYodmFsdWU6IEFycmF5QnVmZmVyKTogQXJyYXlCdWZmZXI7XG4gICAgICBleHBlY3RBc2NpaSh2YWx1ZTogU3RyaW5nKTogU3RyaW5nO1xuICAgICAgZXhwZWN0VXRmOCh2YWx1ZTogU3RyaW5nKTogU3RyaW5nO1xuICAgICAgZXhwZWN0UHJpbmNpcGFsKHZhbHVlOiBTdHJpbmcpOiBTdHJpbmc7XG4gICAgICBleHBlY3RMaXN0KCk6IEFycmF5PFN0cmluZz47XG4gICAgICBleHBlY3RUdXBsZSgpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAgIH1cbiAgXG4gICAgaW50ZXJmYWNlIEFycmF5PFQ+IHtcbiAgICAgIGV4cGVjdFNUWFRyYW5zZmVyRXZlbnQoXG4gICAgICAgIGFtb3VudDogTnVtYmVyIHwgYmlnaW50LFxuICAgICAgICBzZW5kZXI6IFN0cmluZyxcbiAgICAgICAgcmVjaXBpZW50OiBTdHJpbmcsXG4gICAgICApOiBPYmplY3Q7XG4gICAgICBleHBlY3RGdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudChcbiAgICAgICAgYW1vdW50OiBOdW1iZXIgfCBiaWdpbnQsXG4gICAgICAgIHNlbmRlcjogU3RyaW5nLFxuICAgICAgICByZWNpcGllbnQ6IFN0cmluZyxcbiAgICAgICAgYXNzZXRJZDogU3RyaW5nLFxuICAgICAgKTogT2JqZWN0O1xuICAgICAgZXhwZWN0RnVuZ2libGVUb2tlbk1pbnRFdmVudChcbiAgICAgICAgYW1vdW50OiBOdW1iZXIgfCBiaWdpbnQsXG4gICAgICAgIHJlY2lwaWVudDogU3RyaW5nLFxuICAgICAgICBhc3NldElkOiBTdHJpbmcsXG4gICAgICApOiBPYmplY3Q7XG4gICAgICBleHBlY3RGdW5naWJsZVRva2VuQnVybkV2ZW50KFxuICAgICAgICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgICAgICAgc2VuZGVyOiBTdHJpbmcsXG4gICAgICAgIGFzc2V0SWQ6IFN0cmluZyxcbiAgICAgICk6IE9iamVjdDtcbiAgICAgIGV4cGVjdFByaW50RXZlbnQoXG4gICAgICAgIGNvbnRyYWN0X2lkZW50aWZpZXI6IHN0cmluZyxcbiAgICAgICAgdmFsdWU6IHN0cmluZyxcbiAgICAgICk6IE9iamVjdDtcbiAgICAgIGV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50KFxuICAgICAgICB0b2tlbklkOiBTdHJpbmcsXG4gICAgICAgIHNlbmRlcjogU3RyaW5nLFxuICAgICAgICByZWNpcGllbnQ6IFN0cmluZyxcbiAgICAgICAgYXNzZXRBZGRyZXNzOiBTdHJpbmcsXG4gICAgICAgIGFzc2V0SWQ6IFN0cmluZyxcbiAgICAgICk6IE9iamVjdDtcbiAgICAgIGV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5NaW50RXZlbnQoXG4gICAgICAgIHRva2VuSWQ6IFN0cmluZyxcbiAgICAgICAgcmVjaXBpZW50OiBTdHJpbmcsXG4gICAgICAgIGFzc2V0QWRkcmVzczogU3RyaW5nLFxuICAgICAgICBhc3NldElkOiBTdHJpbmcsXG4gICAgICApOiBPYmplY3Q7XG4gICAgICBleHBlY3ROb25GdW5naWJsZVRva2VuQnVybkV2ZW50KFxuICAgICAgICB0b2tlbklkOiBTdHJpbmcsXG4gICAgICAgIHNlbmRlcjogU3RyaW5nLFxuICAgICAgICBhc3NldEFkZHJlc3M6IFN0cmluZyxcbiAgICAgICAgYXNzZXRJZDogU3RyaW5nLFxuICAgICAgKTogT2JqZWN0O1xuICAgICAgLy8gZXhwZWN0RXZlbnQoc2VsOiAoZTogT2JqZWN0KSA9PiBPYmplY3QpOiBPYmplY3Q7XG4gICAgfVxuICB9XG4gIFxuICBmdW5jdGlvbiBjb25zdW1lKHNyYzogU3RyaW5nLCBleHBlY3RhdGlvbjogU3RyaW5nLCB3cmFwcGVkOiBib29sZWFuKSB7XG4gICAgbGV0IGRzdCA9IChcIiBcIiArIHNyYykuc2xpY2UoMSk7XG4gICAgbGV0IHNpemUgPSBleHBlY3RhdGlvbi5sZW5ndGg7XG4gICAgaWYgKCF3cmFwcGVkICYmIHNyYyAhPT0gZXhwZWN0YXRpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEV4cGVjdGVkICR7Z3JlZW4oZXhwZWN0YXRpb24udG9TdHJpbmcoKSl9LCBnb3QgJHtyZWQoc3JjLnRvU3RyaW5nKCkpfWAsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAod3JhcHBlZCkge1xuICAgICAgc2l6ZSArPSAyO1xuICAgIH1cbiAgICBpZiAoZHN0Lmxlbmd0aCA8IHNpemUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEV4cGVjdGVkICR7Z3JlZW4oZXhwZWN0YXRpb24udG9TdHJpbmcoKSl9LCBnb3QgJHtyZWQoc3JjLnRvU3RyaW5nKCkpfWAsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAod3JhcHBlZCkge1xuICAgICAgZHN0ID0gZHN0LnN1YnN0cmluZygxLCBkc3QubGVuZ3RoIC0gMSk7XG4gICAgfVxuICAgIGxldCByZXMgPSBkc3Quc2xpY2UoMCwgZXhwZWN0YXRpb24ubGVuZ3RoKTtcbiAgICBpZiAocmVzICE9PSBleHBlY3RhdGlvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgRXhwZWN0ZWQgJHtncmVlbihleHBlY3RhdGlvbi50b1N0cmluZygpKX0sIGdvdCAke3JlZChzcmMudG9TdHJpbmcoKSl9YCxcbiAgICAgICk7XG4gICAgfVxuICAgIGxldCBsZWZ0UGFkID0gMDtcbiAgICBpZiAoZHN0LmNoYXJBdChleHBlY3RhdGlvbi5sZW5ndGgpID09PSBcIiBcIikge1xuICAgICAgbGVmdFBhZCA9IDE7XG4gICAgfVxuICAgIGxldCByZW1haW5kZXIgPSBkc3Quc3Vic3RyaW5nKGV4cGVjdGF0aW9uLmxlbmd0aCArIGxlZnRQYWQpO1xuICAgIHJldHVybiByZW1haW5kZXI7XG4gIH1cbiAgXG4gIFN0cmluZy5wcm90b3R5cGUuZXhwZWN0T2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGNvbnN1bWUodGhpcywgXCJva1wiLCB0cnVlKTtcbiAgfTtcbiAgXG4gIFN0cmluZy5wcm90b3R5cGUuZXhwZWN0RXJyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBjb25zdW1lKHRoaXMsIFwiZXJyXCIsIHRydWUpO1xuICB9O1xuICBcbiAgU3RyaW5nLnByb3RvdHlwZS5leHBlY3RTb21lID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBjb25zdW1lKHRoaXMsIFwic29tZVwiLCB0cnVlKTtcbiAgfTtcbiAgXG4gIFN0cmluZy5wcm90b3R5cGUuZXhwZWN0Tm9uZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gY29uc3VtZSh0aGlzLCBcIm5vbmVcIiwgZmFsc2UpO1xuICB9O1xuICBcbiAgU3RyaW5nLnByb3RvdHlwZS5leHBlY3RCb29sID0gZnVuY3Rpb24gKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN1bWUodGhpcywgYCR7dmFsdWV9YCwgZmFsc2UpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuICBcbiAgU3RyaW5nLnByb3RvdHlwZS5leHBlY3RVaW50ID0gZnVuY3Rpb24gKHZhbHVlOiBudW1iZXIgfCBiaWdpbnQpOiBiaWdpbnQge1xuICAgIHRyeSB7XG4gICAgICBjb25zdW1lKHRoaXMsIGB1JHt2YWx1ZX1gLCBmYWxzZSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgICByZXR1cm4gQmlnSW50KHZhbHVlKTtcbiAgfTtcbiAgXG4gIFN0cmluZy5wcm90b3R5cGUuZXhwZWN0SW50ID0gZnVuY3Rpb24gKHZhbHVlOiBudW1iZXIgfCBiaWdpbnQpOiBiaWdpbnQge1xuICAgIHRyeSB7XG4gICAgICBjb25zdW1lKHRoaXMsIGAke3ZhbHVlfWAsIGZhbHNlKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICAgIHJldHVybiBCaWdJbnQodmFsdWUpO1xuICB9O1xuICBcbiAgU3RyaW5nLnByb3RvdHlwZS5leHBlY3RCdWZmID0gZnVuY3Rpb24gKHZhbHVlOiBBcnJheUJ1ZmZlcikge1xuICAgIGxldCBidWZmZXIgPSB0eXBlcy5idWZmKHZhbHVlKTtcbiAgICBpZiAodGhpcyAhPT0gYnVmZmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7Z3JlZW4oYnVmZmVyKX0sIGdvdCAke3JlZCh0aGlzLnRvU3RyaW5nKCkpfWApO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG4gIFxuICBTdHJpbmcucHJvdG90eXBlLmV4cGVjdEFzY2lpID0gZnVuY3Rpb24gKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3VtZSh0aGlzLCBgXCIke3ZhbHVlfVwiYCwgZmFsc2UpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuICBcbiAgU3RyaW5nLnByb3RvdHlwZS5leHBlY3RVdGY4ID0gZnVuY3Rpb24gKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3VtZSh0aGlzLCBgdVwiJHt2YWx1ZX1cImAsIGZhbHNlKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcbiAgXG4gIFN0cmluZy5wcm90b3R5cGUuZXhwZWN0UHJpbmNpcGFsID0gZnVuY3Rpb24gKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3VtZSh0aGlzLCBgJHt2YWx1ZX1gLCBmYWxzZSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG4gIFxuICBTdHJpbmcucHJvdG90eXBlLmV4cGVjdExpc3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuY2hhckF0KDApICE9PSBcIltcIiB8fCB0aGlzLmNoYXJBdCh0aGlzLmxlbmd0aCAtIDEpICE9PSBcIl1cIikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgRXhwZWN0ZWQgJHtncmVlbihcIihsaXN0IC4uLilcIil9LCBnb3QgJHtyZWQodGhpcy50b1N0cmluZygpKX1gLFxuICAgICAgKTtcbiAgICB9XG4gIFxuICAgIGxldCBzdGFjayA9IFtdO1xuICAgIGxldCBlbGVtZW50cyA9IFtdO1xuICAgIGxldCBzdGFydCA9IDE7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwiLFwiICYmIHN0YWNrLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGVsZW1lbnRzLnB1c2godGhpcy5zdWJzdHJpbmcoc3RhcnQsIGkpKTtcbiAgICAgICAgc3RhcnQgPSBpICsgMjtcbiAgICAgIH1cbiAgICAgIGlmIChbXCIoXCIsIFwiW1wiLCBcIntcIl0uaW5jbHVkZXModGhpcy5jaGFyQXQoaSkpKSB7XG4gICAgICAgIHN0YWNrLnB1c2godGhpcy5jaGFyQXQoaSkpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIilcIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCIoXCIpIHtcbiAgICAgICAgc3RhY2sucG9wKCk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwifVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIntcIikge1xuICAgICAgICBzdGFjay5wb3AoKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCJdXCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwiW1wiKSB7XG4gICAgICAgIHN0YWNrLnBvcCgpO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgcmVtYWluZGVyID0gdGhpcy5zdWJzdHJpbmcoc3RhcnQsIHRoaXMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKHJlbWFpbmRlci5sZW5ndGggPiAwKSB7XG4gICAgICBlbGVtZW50cy5wdXNoKHJlbWFpbmRlcik7XG4gICAgfVxuICAgIHJldHVybiBlbGVtZW50cztcbiAgfTtcbiAgXG4gIFN0cmluZy5wcm90b3R5cGUuZXhwZWN0VHVwbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuY2hhckF0KDApICE9PSBcIntcIiB8fCB0aGlzLmNoYXJBdCh0aGlzLmxlbmd0aCAtIDEpICE9PSBcIn1cIikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgRXhwZWN0ZWQgJHtncmVlbihcIih0dXBsZSAuLi4pXCIpfSwgZ290ICR7cmVkKHRoaXMudG9TdHJpbmcoKSl9YCxcbiAgICAgICk7XG4gICAgfVxuICBcbiAgICBsZXQgc3RhcnQgPSAxO1xuICAgIGxldCBzdGFjayA9IFtdO1xuICAgIGxldCBlbGVtZW50cyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIixcIiAmJiBzdGFjay5sZW5ndGggPT0gMSkge1xuICAgICAgICBlbGVtZW50cy5wdXNoKHRoaXMuc3Vic3RyaW5nKHN0YXJ0LCBpKSk7XG4gICAgICAgIHN0YXJ0ID0gaSArIDI7XG4gICAgICB9XG4gICAgICBpZiAoW1wiKFwiLCBcIltcIiwgXCJ7XCJdLmluY2x1ZGVzKHRoaXMuY2hhckF0KGkpKSkge1xuICAgICAgICBzdGFjay5wdXNoKHRoaXMuY2hhckF0KGkpKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCIpXCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwiKFwiKSB7XG4gICAgICAgIHN0YWNrLnBvcCgpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIn1cIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCJ7XCIpIHtcbiAgICAgICAgc3RhY2sucG9wKCk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwiXVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIltcIikge1xuICAgICAgICBzdGFjay5wb3AoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IHJlbWFpbmRlciA9IHRoaXMuc3Vic3RyaW5nKHN0YXJ0LCB0aGlzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChyZW1haW5kZXIubGVuZ3RoID4gMCkge1xuICAgICAgZWxlbWVudHMucHVzaChyZW1haW5kZXIpO1xuICAgIH1cbiAgXG4gICAgbGV0IHR1cGxlOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgZm9yIChsZXQgZWxlbWVudCBvZiBlbGVtZW50cykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbGVtZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChlbGVtZW50LmNoYXJBdChpKSA9PT0gXCI6XCIpIHtcbiAgICAgICAgICBsZXQga2V5OiBzdHJpbmcgPSBlbGVtZW50LnN1YnN0cmluZygwLCBpKTtcbiAgICAgICAgICBsZXQgdmFsdWU6IHN0cmluZyA9IGVsZW1lbnQuc3Vic3RyaW5nKGkgKyAyLCBlbGVtZW50Lmxlbmd0aCk7XG4gICAgICAgICAgdHVwbGVba2V5XSA9IHZhbHVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICBcbiAgICByZXR1cm4gdHVwbGU7XG4gIH07XG4gIFxuICBBcnJheS5wcm90b3R5cGUuZXhwZWN0U1RYVHJhbnNmZXJFdmVudCA9IGZ1bmN0aW9uIChcbiAgICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgICBzZW5kZXI6IFN0cmluZyxcbiAgICByZWNpcGllbnQ6IFN0cmluZyxcbiAgKSB7XG4gICAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbGV0IGU6IGFueSA9IHt9O1xuICAgICAgICBlW1wiYW1vdW50XCJdID0gZXZlbnQuc3R4X3RyYW5zZmVyX2V2ZW50LmFtb3VudC5leHBlY3RJbnQoYW1vdW50KTtcbiAgICAgICAgZVtcInNlbmRlclwiXSA9IGV2ZW50LnN0eF90cmFuc2Zlcl9ldmVudC5zZW5kZXIuZXhwZWN0UHJpbmNpcGFsKHNlbmRlcik7XG4gICAgICAgIGVbXCJyZWNpcGllbnRcIl0gPSBldmVudC5zdHhfdHJhbnNmZXJfZXZlbnQucmVjaXBpZW50LmV4cGVjdFByaW5jaXBhbChcbiAgICAgICAgICByZWNpcGllbnQsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBlO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIFNUWFRyYW5zZmVyRXZlbnRgKTtcbiAgfTtcbiAgXG4gIEFycmF5LnByb3RvdHlwZS5leHBlY3RGdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudCA9IGZ1bmN0aW9uIChcbiAgICBhbW91bnQ6IE51bWJlcixcbiAgICBzZW5kZXI6IFN0cmluZyxcbiAgICByZWNpcGllbnQ6IFN0cmluZyxcbiAgICBhc3NldElkOiBTdHJpbmcsXG4gICkge1xuICAgIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxldCBlOiBhbnkgPSB7fTtcbiAgICAgICAgZVtcImFtb3VudFwiXSA9IGV2ZW50LmZ0X3RyYW5zZmVyX2V2ZW50LmFtb3VudC5leHBlY3RJbnQoYW1vdW50KTtcbiAgICAgICAgZVtcInNlbmRlclwiXSA9IGV2ZW50LmZ0X3RyYW5zZmVyX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKTtcbiAgICAgICAgZVtcInJlY2lwaWVudFwiXSA9IGV2ZW50LmZ0X3RyYW5zZmVyX2V2ZW50LnJlY2lwaWVudC5leHBlY3RQcmluY2lwYWwoXG4gICAgICAgICAgcmVjaXBpZW50LFxuICAgICAgICApO1xuICAgICAgICBpZiAoZXZlbnQuZnRfdHJhbnNmZXJfZXZlbnQuYXNzZXRfaWRlbnRpZmllci5lbmRzV2l0aChhc3NldElkKSkge1xuICAgICAgICAgIGVbXCJhc3NldElkXCJdID0gZXZlbnQuZnRfdHJhbnNmZXJfZXZlbnQuYXNzZXRfaWRlbnRpZmllcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIEZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50KCR7YW1vdW50fSwgJHtzZW5kZXJ9LCAke3JlY2lwaWVudH0sICR7YXNzZXRJZH0pXFxuJHtcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkodGhpcylcbiAgICAgIH1gLFxuICAgICk7XG4gIH07XG4gIFxuICBBcnJheS5wcm90b3R5cGUuZXhwZWN0RnVuZ2libGVUb2tlbk1pbnRFdmVudCA9IGZ1bmN0aW9uIChcbiAgICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgICByZWNpcGllbnQ6IFN0cmluZyxcbiAgICBhc3NldElkOiBTdHJpbmcsXG4gICkge1xuICAgIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxldCBlOiBhbnkgPSB7fTtcbiAgICAgICAgZVtcImFtb3VudFwiXSA9IGV2ZW50LmZ0X21pbnRfZXZlbnQuYW1vdW50LmV4cGVjdEludChhbW91bnQpO1xuICAgICAgICBlW1wicmVjaXBpZW50XCJdID0gZXZlbnQuZnRfbWludF9ldmVudC5yZWNpcGllbnQuZXhwZWN0UHJpbmNpcGFsKHJlY2lwaWVudCk7XG4gICAgICAgIGlmIChldmVudC5mdF9taW50X2V2ZW50LmFzc2V0X2lkZW50aWZpZXIuZW5kc1dpdGgoYXNzZXRJZCkpIHtcbiAgICAgICAgICBlW1wiYXNzZXRJZFwiXSA9IGV2ZW50LmZ0X21pbnRfZXZlbnQuYXNzZXRfaWRlbnRpZmllcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBGdW5naWJsZVRva2VuTWludEV2ZW50YCk7XG4gIH07XG4gIFxuICBBcnJheS5wcm90b3R5cGUuZXhwZWN0RnVuZ2libGVUb2tlbkJ1cm5FdmVudCA9IGZ1bmN0aW9uIChcbiAgICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgICBzZW5kZXI6IFN0cmluZyxcbiAgICBhc3NldElkOiBTdHJpbmcsXG4gICkge1xuICAgIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxldCBlOiBhbnkgPSB7fTtcbiAgICAgICAgZVtcImFtb3VudFwiXSA9IGV2ZW50LmZ0X2J1cm5fZXZlbnQuYW1vdW50LmV4cGVjdEludChhbW91bnQpO1xuICAgICAgICBlW1wic2VuZGVyXCJdID0gZXZlbnQuZnRfYnVybl9ldmVudC5zZW5kZXIuZXhwZWN0UHJpbmNpcGFsKHNlbmRlcik7XG4gICAgICAgIGlmIChldmVudC5mdF9idXJuX2V2ZW50LmFzc2V0X2lkZW50aWZpZXIuZW5kc1dpdGgoYXNzZXRJZCkpIHtcbiAgICAgICAgICBlW1wiYXNzZXRJZFwiXSA9IGV2ZW50LmZ0X2J1cm5fZXZlbnQuYXNzZXRfaWRlbnRpZmllcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBGdW5naWJsZVRva2VuQnVybkV2ZW50YCk7XG4gIH07XG4gIFxuICBBcnJheS5wcm90b3R5cGUuZXhwZWN0UHJpbnRFdmVudCA9IGZ1bmN0aW9uIChcbiAgICBjb250cmFjdF9pZGVudGlmaWVyOiBzdHJpbmcsXG4gICAgdmFsdWU6IHN0cmluZyxcbiAgKSB7XG4gICAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbGV0IGU6IGFueSA9IHt9O1xuICAgICAgICBlW1wiY29udHJhY3RfaWRlbnRpZmllclwiXSA9IGV2ZW50LmNvbnRyYWN0X2V2ZW50LmNvbnRyYWN0X2lkZW50aWZpZXJcbiAgICAgICAgICAuZXhwZWN0UHJpbmNpcGFsKFxuICAgICAgICAgICAgY29udHJhY3RfaWRlbnRpZmllcixcbiAgICAgICAgICApO1xuICBcbiAgICAgICAgaWYgKGV2ZW50LmNvbnRyYWN0X2V2ZW50LnRvcGljLmVuZHNXaXRoKFwicHJpbnRcIikpIHtcbiAgICAgICAgICBlW1widG9waWNcIl0gPSBldmVudC5jb250cmFjdF9ldmVudC50b3BpYztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICBcbiAgICAgICAgaWYgKGV2ZW50LmNvbnRyYWN0X2V2ZW50LnZhbHVlLmVuZHNXaXRoKHZhbHVlKSkge1xuICAgICAgICAgIGVbXCJ2YWx1ZVwiXSA9IGV2ZW50LmNvbnRyYWN0X2V2ZW50LnZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIFByaW50RXZlbnRgKTtcbiAgfTtcbiAgLy8gQXJyYXkucHJvdG90eXBlLmV4cGVjdEV2ZW50ID0gZnVuY3Rpb24oc2VsOiAoZTogT2JqZWN0KSA9PiBPYmplY3QpIHtcbiAgLy8gICAgIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgLy8gICAgICAgICB0cnkge1xuICAvLyAgICAgICAgICAgICBzZWwoZXZlbnQpO1xuICAvLyAgICAgICAgICAgICByZXR1cm4gZXZlbnQgYXMgT2JqZWN0O1xuICAvLyAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gIC8vICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAvLyAgICAgICAgIH1cbiAgLy8gICAgIH1cbiAgLy8gICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIFByaW50RXZlbnRgKTtcbiAgLy8gfVxuICBBcnJheS5wcm90b3R5cGUuZXhwZWN0Tm9uRnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQgPSBmdW5jdGlvbiAoXG4gICAgdG9rZW5JZDogU3RyaW5nLFxuICAgIHNlbmRlcjogU3RyaW5nLFxuICAgIHJlY2lwaWVudDogU3RyaW5nLFxuICAgIGFzc2V0QWRkcmVzczogU3RyaW5nLFxuICAgIGFzc2V0SWQ6IFN0cmluZyxcbiAgKSB7XG4gICAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbGV0IGU6IGFueSA9IHt9O1xuICAgICAgICBpZiAoZXZlbnQubmZ0X3RyYW5zZmVyX2V2ZW50LnZhbHVlID09PSB0b2tlbklkKSB7XG4gICAgICAgICAgZVtcInRva2VuSWRcIl0gPSBldmVudC5uZnRfdHJhbnNmZXJfZXZlbnQudmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgZVtcInNlbmRlclwiXSA9IGV2ZW50Lm5mdF90cmFuc2Zlcl9ldmVudC5zZW5kZXIuZXhwZWN0UHJpbmNpcGFsKHNlbmRlcik7XG4gICAgICAgIGVbXCJyZWNpcGllbnRcIl0gPSBldmVudC5uZnRfdHJhbnNmZXJfZXZlbnQucmVjaXBpZW50LmV4cGVjdFByaW5jaXBhbChcbiAgICAgICAgICByZWNpcGllbnQsXG4gICAgICAgICk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBldmVudC5uZnRfdHJhbnNmZXJfZXZlbnQuYXNzZXRfaWRlbnRpZmllciA9PT1cbiAgICAgICAgICAgIGAke2Fzc2V0QWRkcmVzc306OiR7YXNzZXRJZH1gXG4gICAgICAgICkge1xuICAgICAgICAgIGVbXCJhc3NldElkXCJdID0gZXZlbnQubmZ0X3RyYW5zZmVyX2V2ZW50LmFzc2V0X2lkZW50aWZpZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGU7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgTm9uRnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnRgKTtcbiAgfTtcbiAgXG4gIEFycmF5LnByb3RvdHlwZS5leHBlY3ROb25GdW5naWJsZVRva2VuTWludEV2ZW50ID0gZnVuY3Rpb24gKFxuICAgIHRva2VuSWQ6IFN0cmluZyxcbiAgICByZWNpcGllbnQ6IFN0cmluZyxcbiAgICBhc3NldEFkZHJlc3M6IFN0cmluZyxcbiAgICBhc3NldElkOiBTdHJpbmcsXG4gICkge1xuICAgIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxldCBlOiBhbnkgPSB7fTtcbiAgICAgICAgaWYgKGV2ZW50Lm5mdF9taW50X2V2ZW50LnZhbHVlID09PSB0b2tlbklkKSB7XG4gICAgICAgICAgZVtcInRva2VuSWRcIl0gPSBldmVudC5uZnRfbWludF9ldmVudC52YWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBlW1wicmVjaXBpZW50XCJdID0gZXZlbnQubmZ0X21pbnRfZXZlbnQucmVjaXBpZW50LmV4cGVjdFByaW5jaXBhbChcbiAgICAgICAgICByZWNpcGllbnQsXG4gICAgICAgICk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBldmVudC5uZnRfbWludF9ldmVudC5hc3NldF9pZGVudGlmaWVyID09PSBgJHthc3NldEFkZHJlc3N9Ojoke2Fzc2V0SWR9YFxuICAgICAgICApIHtcbiAgICAgICAgICBlW1wiYXNzZXRJZFwiXSA9IGV2ZW50Lm5mdF9taW50X2V2ZW50LmFzc2V0X2lkZW50aWZpZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGU7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgTm9uRnVuZ2libGVUb2tlbk1pbnRFdmVudGApO1xuICB9O1xuICBcbiAgQXJyYXkucHJvdG90eXBlLmV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQgPSBmdW5jdGlvbiAoXG4gICAgdG9rZW5JZDogU3RyaW5nLFxuICAgIHNlbmRlcjogU3RyaW5nLFxuICAgIGFzc2V0QWRkcmVzczogU3RyaW5nLFxuICAgIGFzc2V0SWQ6IFN0cmluZyxcbiAgKSB7XG4gICAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbGV0IGU6IGFueSA9IHt9O1xuICAgICAgICBpZiAoZXZlbnQubmZ0X2J1cm5fZXZlbnQudmFsdWUgPT09IHRva2VuSWQpIHtcbiAgICAgICAgICBlW1widG9rZW5JZFwiXSA9IGV2ZW50Lm5mdF9idXJuX2V2ZW50LnZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGVbXCJzZW5kZXJcIl0gPSBldmVudC5uZnRfYnVybl9ldmVudC5zZW5kZXIuZXhwZWN0UHJpbmNpcGFsKHNlbmRlcik7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBldmVudC5uZnRfYnVybl9ldmVudC5hc3NldF9pZGVudGlmaWVyID09PSBgJHthc3NldEFkZHJlc3N9Ojoke2Fzc2V0SWR9YFxuICAgICAgICApIHtcbiAgICAgICAgICBlW1wiYXNzZXRJZFwiXSA9IGV2ZW50Lm5mdF9idXJuX2V2ZW50LmFzc2V0X2lkZW50aWZpZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGU7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgTm9uRnVuZ2libGVUb2tlbkJ1cm5FdmVudGApO1xuICB9O1xuICBcbiAgY29uc3Qgbm9Db2xvciA9IGdsb2JhbFRoaXMuRGVubz8ubm9Db2xvciA/PyB0cnVlO1xuICBcbiAgaW50ZXJmYWNlIENvZGUge1xuICAgIG9wZW46IHN0cmluZztcbiAgICBjbG9zZTogc3RyaW5nO1xuICAgIHJlZ2V4cDogUmVnRXhwO1xuICB9XG4gIFxuICBsZXQgZW5hYmxlZCA9ICFub0NvbG9yO1xuICBcbiAgZnVuY3Rpb24gY29kZShvcGVuOiBudW1iZXJbXSwgY2xvc2U6IG51bWJlcik6IENvZGUge1xuICAgIHJldHVybiB7XG4gICAgICBvcGVuOiBgXFx4MWJbJHtvcGVuLmpvaW4oXCI7XCIpfW1gLFxuICAgICAgY2xvc2U6IGBcXHgxYlske2Nsb3NlfW1gLFxuICAgICAgcmVnZXhwOiBuZXcgUmVnRXhwKGBcXFxceDFiXFxcXFske2Nsb3NlfW1gLCBcImdcIiksXG4gICAgfTtcbiAgfVxuICBcbiAgZnVuY3Rpb24gcnVuKHN0cjogc3RyaW5nLCBjb2RlOiBDb2RlKTogc3RyaW5nIHtcbiAgICByZXR1cm4gZW5hYmxlZFxuICAgICAgPyBgJHtjb2RlLm9wZW59JHtzdHIucmVwbGFjZShjb2RlLnJlZ2V4cCwgY29kZS5vcGVuKX0ke2NvZGUuY2xvc2V9YFxuICAgICAgOiBzdHI7XG4gIH1cbiAgXG4gIGV4cG9ydCBmdW5jdGlvbiByZWQoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBydW4oc3RyLCBjb2RlKFszMV0sIDM5KSk7XG4gIH1cbiAgXG4gIGV4cG9ydCBmdW5jdGlvbiBncmVlbihzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHJ1bihzdHIsIGNvZGUoWzMyXSwgMzkpKTtcbiAgfVxuICAiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxNQUFNLEVBQUU7SUFDWCxJQUFJLENBQVM7SUFDYixNQUFNLENBQVM7SUFDZixZQUFZLENBQWtCO0lBQzlCLFdBQVcsQ0FBYztJQUN6QixjQUFjLENBQW9CO0lBRWxDLFlBQVksSUFBWSxFQUFFLE1BQWMsQ0FBRTtRQUN4QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztLQUN0QjtJQUVELE9BQU8sV0FBVyxDQUFDLE1BQWMsRUFBRSxTQUFpQixFQUFFLE1BQWMsRUFBRTtRQUNwRSxJQUFJLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEFBQUM7UUFDM0IsRUFBRSxDQUFDLFdBQVcsR0FBRztZQUNmLFNBQVM7WUFDVCxNQUFNO1NBQ1AsQ0FBQztRQUNGLE9BQU8sRUFBRSxDQUFDO0tBQ1g7SUFFRCxPQUFPLFlBQVksQ0FDakIsUUFBZ0IsRUFDaEIsTUFBYyxFQUNkLElBQW1CLEVBQ25CLE1BQWMsRUFDZDtRQUNBLElBQUksRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQUFBQztRQUMzQixFQUFFLENBQUMsWUFBWSxHQUFHO1lBQ2hCLFFBQVE7WUFDUixNQUFNO1lBQ04sSUFBSTtT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QyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFFO1FBQ3BDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7WUFDL0MsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3hDLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ2Y7UUFDRCxJQUFJO1lBQUMsR0FBRztZQUFFLEdBQUc7WUFBRSxHQUFHO1NBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQzVDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzVCO1FBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7WUFDN0QsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1NBQ2I7UUFDRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUM3RCxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDYjtRQUNELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQzdELEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztTQUNiO0tBQ0Y7SUFDRCxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMs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