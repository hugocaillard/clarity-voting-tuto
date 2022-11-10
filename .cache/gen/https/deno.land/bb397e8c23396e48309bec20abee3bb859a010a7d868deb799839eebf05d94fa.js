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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvY2xhcmluZXRAdjEuMC4xL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjbGFzcyBUeCB7XG4gIHR5cGU6IG51bWJlcjtcbiAgc2VuZGVyOiBzdHJpbmc7XG4gIGNvbnRyYWN0Q2FsbD86IFR4Q29udHJhY3RDYWxsO1xuICB0cmFuc2ZlclN0eD86IFR4VHJhbnNmZXI7XG4gIGRlcGxveUNvbnRyYWN0PzogVHhEZXBsb3lDb250cmFjdDtcblxuICBjb25zdHJ1Y3Rvcih0eXBlOiBudW1iZXIsIHNlbmRlcjogc3RyaW5nKSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLnNlbmRlciA9IHNlbmRlcjtcbiAgfVxuXG4gIHN0YXRpYyB0cmFuc2ZlclNUWChhbW91bnQ6IG51bWJlciwgcmVjaXBpZW50OiBzdHJpbmcsIHNlbmRlcjogc3RyaW5nKSB7XG4gICAgbGV0IHR4ID0gbmV3IFR4KDEsIHNlbmRlcik7XG4gICAgdHgudHJhbnNmZXJTdHggPSB7XG4gICAgICByZWNpcGllbnQsXG4gICAgICBhbW91bnQsXG4gICAgfTtcbiAgICByZXR1cm4gdHg7XG4gIH1cblxuICBzdGF0aWMgY29udHJhY3RDYWxsKFxuICAgIGNvbnRyYWN0OiBzdHJpbmcsXG4gICAgbWV0aG9kOiBzdHJpbmcsXG4gICAgYXJnczogQXJyYXk8c3RyaW5nPixcbiAgICBzZW5kZXI6IHN0cmluZyxcbiAgKSB7XG4gICAgbGV0IHR4ID0gbmV3IFR4KDIsIHNlbmRlcik7XG4gICAgdHguY29udHJhY3RDYWxsID0ge1xuICAgICAgY29udHJhY3QsXG4gICAgICBtZXRob2QsXG4gICAgICBhcmdzLFxuICAgIH07XG4gICAgcmV0dXJuIHR4O1xuICB9XG5cbiAgc3RhdGljIGRlcGxveUNvbnRyYWN0KG5hbWU6IHN0cmluZywgY29kZTogc3RyaW5nLCBzZW5kZXI6IHN0cmluZykge1xuICAgIGxldCB0eCA9IG5ldyBUeCgzLCBzZW5kZXIpO1xuICAgIHR4LmRlcGxveUNvbnRyYWN0ID0ge1xuICAgICAgbmFtZSxcbiAgICAgIGNvZGUsXG4gICAgfTtcbiAgICByZXR1cm4gdHg7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeENvbnRyYWN0Q2FsbCB7XG4gIGNvbnRyYWN0OiBzdHJpbmc7XG4gIG1ldGhvZDogc3RyaW5nO1xuICBhcmdzOiBBcnJheTxzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFR4RGVwbG95Q29udHJhY3Qge1xuICBjb2RlOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeFRyYW5zZmVyIHtcbiAgYW1vdW50OiBudW1iZXI7XG4gIHJlY2lwaWVudDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFR4UmVjZWlwdCB7XG4gIHJlc3VsdDogc3RyaW5nO1xuICBldmVudHM6IEFycmF5PGFueT47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmxvY2sge1xuICBoZWlnaHQ6IG51bWJlcjtcbiAgcmVjZWlwdHM6IEFycmF5PFR4UmVjZWlwdD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQWNjb3VudCB7XG4gIGFkZHJlc3M6IHN0cmluZztcbiAgYmFsYW5jZTogbnVtYmVyO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2hhaW4ge1xuICBzZXNzaW9uSWQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWFkT25seUZuIHtcbiAgc2Vzc2lvbl9pZDogbnVtYmVyO1xuICByZXN1bHQ6IHN0cmluZztcbiAgZXZlbnRzOiBBcnJheTxhbnk+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVtcHR5QmxvY2sge1xuICBzZXNzaW9uX2lkOiBudW1iZXI7XG4gIGJsb2NrX2hlaWdodDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFzc2V0c01hcHMge1xuICBzZXNzaW9uX2lkOiBudW1iZXI7XG4gIGFzc2V0czoge1xuICAgIFtuYW1lOiBzdHJpbmddOiB7XG4gICAgICBbb3duZXI6IHN0cmluZ106IG51bWJlcjtcbiAgICB9O1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhaW4ge1xuICBzZXNzaW9uSWQ6IG51bWJlcjtcbiAgYmxvY2tIZWlnaHQ6IG51bWJlciA9IDE7XG5cbiAgY29uc3RydWN0b3Ioc2Vzc2lvbklkOiBudW1iZXIpIHtcbiAgICB0aGlzLnNlc3Npb25JZCA9IHNlc3Npb25JZDtcbiAgfVxuXG4gIG1pbmVCbG9jayh0cmFuc2FjdGlvbnM6IEFycmF5PFR4Pik6IEJsb2NrIHtcbiAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZSgoRGVubyBhcyBhbnkpLmNvcmUub3BTeW5jKFwiYXBpL3YxL21pbmVfYmxvY2tcIiwge1xuICAgICAgc2Vzc2lvbklkOiB0aGlzLnNlc3Npb25JZCxcbiAgICAgIHRyYW5zYWN0aW9uczogdHJhbnNhY3Rpb25zLFxuICAgIH0pKTtcbiAgICB0aGlzLmJsb2NrSGVpZ2h0ID0gcmVzdWx0LmJsb2NrX2hlaWdodDtcbiAgICBsZXQgYmxvY2s6IEJsb2NrID0ge1xuICAgICAgaGVpZ2h0OiByZXN1bHQuYmxvY2tfaGVpZ2h0LFxuICAgICAgcmVjZWlwdHM6IHJlc3VsdC5yZWNlaXB0cyxcbiAgICB9O1xuICAgIHJldHVybiBibG9jaztcbiAgfVxuXG4gIG1pbmVFbXB0eUJsb2NrKGNvdW50OiBudW1iZXIpOiBFbXB0eUJsb2NrIHtcbiAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgIChEZW5vIGFzIGFueSkuY29yZS5vcFN5bmMoXCJhcGkvdjEvbWluZV9lbXB0eV9ibG9ja3NcIiwge1xuICAgICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgICAgICBjb3VudDogY291bnQsXG4gICAgICB9KSxcbiAgICApO1xuICAgIHRoaXMuYmxvY2tIZWlnaHQgPSByZXN1bHQuYmxvY2tfaGVpZ2h0O1xuICAgIGxldCBlbXB0eUJsb2NrOiBFbXB0eUJsb2NrID0ge1xuICAgICAgc2Vzc2lvbl9pZDogcmVzdWx0LnNlc3Npb25faWQsXG4gICAgICBibG9ja19oZWlnaHQ6IHJlc3VsdC5ibG9ja19oZWlnaHQsXG4gICAgfTtcbiAgICByZXR1cm4gZW1wdHlCbG9jaztcbiAgfVxuXG4gIG1pbmVFbXB0eUJsb2NrVW50aWwodGFyZ2V0QmxvY2tIZWlnaHQ6IG51bWJlcik6IEVtcHR5QmxvY2sge1xuICAgIGxldCBjb3VudCA9IHRhcmdldEJsb2NrSGVpZ2h0IC0gdGhpcy5ibG9ja0hlaWdodDtcbiAgICBpZiAoY291bnQgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBDaGFpbiB0aXAgY2Fubm90IGJlIG1vdmVkIGZyb20gJHt0aGlzLmJsb2NrSGVpZ2h0fSB0byAke3RhcmdldEJsb2NrSGVpZ2h0fWAsXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5taW5lRW1wdHlCbG9jayhjb3VudCk7XG4gIH1cblxuICBjYWxsUmVhZE9ubHlGbihcbiAgICBjb250cmFjdDogc3RyaW5nLFxuICAgIG1ldGhvZDogc3RyaW5nLFxuICAgIGFyZ3M6IEFycmF5PGFueT4sXG4gICAgc2VuZGVyOiBzdHJpbmcsXG4gICk6IFJlYWRPbmx5Rm4ge1xuICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgKERlbm8gYXMgYW55KS5jb3JlLm9wU3luYyhcImFwaS92MS9jYWxsX3JlYWRfb25seV9mblwiLCB7XG4gICAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXG4gICAgICAgIGNvbnRyYWN0OiBjb250cmFjdCxcbiAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgIGFyZ3M6IGFyZ3MsXG4gICAgICAgIHNlbmRlcjogc2VuZGVyLFxuICAgICAgfSksXG4gICAgKTtcbiAgICBsZXQgcmVhZE9ubHlGbjogUmVhZE9ubHlGbiA9IHtcbiAgICAgIHNlc3Npb25faWQ6IHJlc3VsdC5zZXNzaW9uX2lkLFxuICAgICAgcmVzdWx0OiByZXN1bHQucmVzdWx0LFxuICAgICAgZXZlbnRzOiByZXN1bHQuZXZlbnRzLFxuICAgIH07XG4gICAgcmV0dXJuIHJlYWRPbmx5Rm47XG4gIH1cblxuICBnZXRBc3NldHNNYXBzKCk6IEFzc2V0c01hcHMge1xuICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgKERlbm8gYXMgYW55KS5jb3JlLm9wU3luYyhcImFwaS92MS9nZXRfYXNzZXRzX21hcHNcIiwge1xuICAgICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgICAgfSksXG4gICAgKTtcbiAgICBsZXQgYXNzZXRzTWFwczogQXNzZXRzTWFwcyA9IHtcbiAgICAgIHNlc3Npb25faWQ6IHJlc3VsdC5zZXNzaW9uX2lkLFxuICAgICAgYXNzZXRzOiByZXN1bHQuYXNzZXRzLFxuICAgIH07XG4gICAgcmV0dXJuIGFzc2V0c01hcHM7XG4gIH1cbn1cblxudHlwZSBQcmVEZXBsb3ltZW50RnVuY3Rpb24gPSAoXG4gIGNoYWluOiBDaGFpbixcbiAgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+LFxuKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcblxudHlwZSBUZXN0RnVuY3Rpb24gPSAoXG4gIGNoYWluOiBDaGFpbixcbiAgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+LFxuICBjb250cmFjdHM6IE1hcDxzdHJpbmcsIENvbnRyYWN0PixcbikgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG50eXBlIFByZVNldHVwRnVuY3Rpb24gPSAoKSA9PiBBcnJheTxUeD47XG5cbmludGVyZmFjZSBVbml0VGVzdE9wdGlvbnMge1xuICBuYW1lOiBzdHJpbmc7XG4gIG9ubHk/OiB0cnVlO1xuICBpZ25vcmU/OiB0cnVlO1xuICBkZXBsb3ltZW50UGF0aD86IHN0cmluZztcbiAgcHJlRGVwbG95bWVudD86IFByZURlcGxveW1lbnRGdW5jdGlvbjtcbiAgZm46IFRlc3RGdW5jdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb250cmFjdCB7XG4gIGNvbnRyYWN0X2lkOiBzdHJpbmc7XG4gIHNvdXJjZTogc3RyaW5nO1xuICBjb250cmFjdF9pbnRlcmZhY2U6IGFueTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdGFja3NOb2RlIHtcbiAgdXJsOiBzdHJpbmc7XG59XG5cbnR5cGUgU2NyaXB0RnVuY3Rpb24gPSAoXG4gIGFjY291bnRzOiBNYXA8c3RyaW5nLCBBY2NvdW50PixcbiAgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD4sXG4gIG5vZGU6IFN0YWNrc05vZGUsXG4pID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG5pbnRlcmZhY2UgU2NyaXB0T3B0aW9ucyB7XG4gIGZuOiBTY3JpcHRGdW5jdGlvbjtcbn1cblxuZXhwb3J0IGNsYXNzIENsYXJpbmV0IHtcbiAgc3RhdGljIHRlc3Qob3B0aW9uczogVW5pdFRlc3RPcHRpb25zKSB7XG4gICAgRGVuby50ZXN0KHtcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIG9ubHk6IG9wdGlvbnMub25seSxcbiAgICAgIGlnbm9yZTogb3B0aW9ucy5pZ25vcmUsXG4gICAgICBhc3luYyBmbigpIHtcbiAgICAgICAgKERlbm8gYXMgYW55KS5jb3JlLm9wcygpO1xuXG4gICAgICAgIGxldCBoYXNQcmVEZXBsb3ltZW50U3RlcHMgPSBvcHRpb25zLnByZURlcGxveW1lbnQgIT09IHVuZGVmaW5lZDtcblxuICAgICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgICAgICAoRGVubyBhcyBhbnkpLmNvcmUub3BTeW5jKFwiYXBpL3YxL25ld19zZXNzaW9uXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgICAgICAgIGxvYWREZXBsb3ltZW50OiAhaGFzUHJlRGVwbG95bWVudFN0ZXBzLFxuICAgICAgICAgICAgZGVwbG95bWVudFBhdGg6IG9wdGlvbnMuZGVwbG95bWVudFBhdGgsXG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucHJlRGVwbG95bWVudCkge1xuICAgICAgICAgIGxldCBjaGFpbiA9IG5ldyBDaGFpbihyZXN1bHRbXCJzZXNzaW9uX2lkXCJdKTtcbiAgICAgICAgICBsZXQgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+ID0gbmV3IE1hcCgpO1xuICAgICAgICAgIGZvciAobGV0IGFjY291bnQgb2YgcmVzdWx0W1wiYWNjb3VudHNcIl0pIHtcbiAgICAgICAgICAgIGFjY291bnRzLnNldChhY2NvdW50Lm5hbWUsIGFjY291bnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhd2FpdCBvcHRpb25zLnByZURlcGxveW1lbnQoY2hhaW4sIGFjY291bnRzKTtcblxuICAgICAgICAgIHJlc3VsdCA9IEpTT04ucGFyc2UoXG4gICAgICAgICAgICAoRGVubyBhcyBhbnkpLmNvcmUub3BTeW5jKFwiYXBpL3YxL2xvYWRfZGVwbG95bWVudFwiLCB7XG4gICAgICAgICAgICAgIHNlc3Npb25JZDogY2hhaW4uc2Vzc2lvbklkLFxuICAgICAgICAgICAgICBkZXBsb3ltZW50UGF0aDogb3B0aW9ucy5kZXBsb3ltZW50UGF0aCxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY2hhaW4gPSBuZXcgQ2hhaW4ocmVzdWx0W1wic2Vzc2lvbl9pZFwiXSk7XG4gICAgICAgIGxldCBhY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD4gPSBuZXcgTWFwKCk7XG4gICAgICAgIGZvciAobGV0IGFjY291bnQgb2YgcmVzdWx0W1wiYWNjb3VudHNcIl0pIHtcbiAgICAgICAgICBhY2NvdW50cy5zZXQoYWNjb3VudC5uYW1lLCBhY2NvdW50KTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD4gPSBuZXcgTWFwKCk7XG4gICAgICAgIGZvciAobGV0IGNvbnRyYWN0IG9mIHJlc3VsdFtcImNvbnRyYWN0c1wiXSkge1xuICAgICAgICAgIGNvbnRyYWN0cy5zZXQoY29udHJhY3QuY29udHJhY3RfaWQsIGNvbnRyYWN0KTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBvcHRpb25zLmZuKGNoYWluLCBhY2NvdW50cywgY29udHJhY3RzKTtcblxuICAgICAgICBKU09OLnBhcnNlKChEZW5vIGFzIGFueSkuY29yZS5vcFN5bmMoXCJhcGkvdjEvdGVybWluYXRlX3Nlc3Npb25cIiwge1xuICAgICAgICAgIHNlc3Npb25JZDogY2hhaW4uc2Vzc2lvbklkLFxuICAgICAgICB9KSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgc3RhdGljIHJ1bihvcHRpb25zOiBTY3JpcHRPcHRpb25zKSB7XG4gICAgRGVuby50ZXN0KHtcbiAgICAgIG5hbWU6IFwicnVubmluZyBzY3JpcHRcIixcbiAgICAgIGFzeW5jIGZuKCkge1xuICAgICAgICAoRGVubyBhcyBhbnkpLmNvcmUub3BzKCk7XG4gICAgICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgICAgIChEZW5vIGFzIGFueSkuY29yZS5vcFN5bmMoXCJhcGkvdjEvbmV3X3Nlc3Npb25cIiwge1xuICAgICAgICAgICAgbmFtZTogXCJydW5uaW5nIHNjcmlwdFwiLFxuICAgICAgICAgICAgbG9hZERlcGxveW1lbnQ6IHRydWUsXG4gICAgICAgICAgICBkZXBsb3ltZW50UGF0aDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgICBsZXQgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+ID0gbmV3IE1hcCgpO1xuICAgICAgICBmb3IgKGxldCBhY2NvdW50IG9mIHJlc3VsdFtcImFjY291bnRzXCJdKSB7XG4gICAgICAgICAgYWNjb3VudHMuc2V0KGFjY291bnQubmFtZSwgYWNjb3VudCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGNvbnRyYWN0czogTWFwPHN0cmluZywgQ29udHJhY3Q+ID0gbmV3IE1hcCgpO1xuICAgICAgICBmb3IgKGxldCBjb250cmFjdCBvZiByZXN1bHRbXCJjb250cmFjdHNcIl0pIHtcbiAgICAgICAgICBjb250cmFjdHMuc2V0KGNvbnRyYWN0LmNvbnRyYWN0X2lkLCBjb250cmFjdCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHN0YWNrc19ub2RlOiBTdGFja3NOb2RlID0ge1xuICAgICAgICAgIHVybDogcmVzdWx0W1wic3RhY2tzX25vZGVfdXJsXCJdLFxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCBvcHRpb25zLmZuKGFjY291bnRzLCBjb250cmFjdHMsIHN0YWNrc19ub2RlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSB0eXBlcyB7XG4gIGNvbnN0IGJ5dGVUb0hleDogYW55ID0gW107XG4gIGZvciAobGV0IG4gPSAwOyBuIDw9IDB4ZmY7ICsrbikge1xuICAgIGNvbnN0IGhleE9jdGV0ID0gbi50b1N0cmluZygxNikucGFkU3RhcnQoMiwgXCIwXCIpO1xuICAgIGJ5dGVUb0hleC5wdXNoKGhleE9jdGV0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNlcmlhbGl6ZVR1cGxlKGlucHV0OiBPYmplY3QpIHtcbiAgICBsZXQgaXRlbXM6IEFycmF5PHN0cmluZz4gPSBbXTtcbiAgICBmb3IgKHZhciBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoaW5wdXQpKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIGl0ZW1zLnB1c2goYCR7a2V5fTogeyAke3NlcmlhbGl6ZVR1cGxlKHZhbHVlKX0gfWApO1xuICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAvLyB0b2RvKGx1ZG8pOiBub3Qgc3VwcG9ydGVkLCBzaG91bGQgcGFuaWNcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGl0ZW1zLnB1c2goYCR7a2V5fTogJHt2YWx1ZX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zLmpvaW4oXCIsIFwiKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzT2JqZWN0KG9iajogYW55KSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvYmogPT09IFwib2JqZWN0XCIgJiYgIUFycmF5LmlzQXJyYXkob2JqKTtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBvayh2YWw6IHN0cmluZykge1xuICAgIHJldHVybiBgKG9rICR7dmFsfSlgO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIGVycih2YWw6IHN0cmluZykge1xuICAgIHJldHVybiBgKGVyciAke3ZhbH0pYDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBzb21lKHZhbDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAoc29tZSAke3ZhbH0pYDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBub25lKCkge1xuICAgIHJldHVybiBgbm9uZWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gYm9vbCh2YWw6IGJvb2xlYW4pIHtcbiAgICByZXR1cm4gYCR7dmFsfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gaW50KHZhbDogbnVtYmVyIHwgYmlnaW50KSB7XG4gICAgcmV0dXJuIGAke3ZhbH1gO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIHVpbnQodmFsOiBudW1iZXIgfCBiaWdpbnQpIHtcbiAgICByZXR1cm4gYHUke3ZhbH1gO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIGFzY2lpKHZhbDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHZhbCk7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gdXRmOCh2YWw6IHN0cmluZykge1xuICAgIHJldHVybiBgdSR7SlNPTi5zdHJpbmdpZnkodmFsKX1gO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIGJ1ZmYodmFsOiBBcnJheUJ1ZmZlciB8IHN0cmluZykge1xuICAgIGNvbnN0IGJ1ZmYgPSB0eXBlb2YgdmFsID09IFwic3RyaW5nXCJcbiAgICAgID8gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKHZhbClcbiAgICAgIDogbmV3IFVpbnQ4QXJyYXkodmFsKTtcblxuICAgIGNvbnN0IGhleE9jdGV0cyA9IG5ldyBBcnJheShidWZmLmxlbmd0aCk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmYubGVuZ3RoOyArK2kpIHtcbiAgICAgIGhleE9jdGV0c1tpXSA9IGJ5dGVUb0hleFtidWZmW2ldXTtcbiAgICB9XG5cbiAgICByZXR1cm4gYDB4JHtoZXhPY3RldHMuam9pbihcIlwiKX1gO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIGxpc3QodmFsOiBBcnJheTxhbnk+KSB7XG4gICAgcmV0dXJuIGAobGlzdCAke3ZhbC5qb2luKFwiIFwiKX0pYDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBwcmluY2lwYWwodmFsOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gYCcke3ZhbH1gO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIHR1cGxlKHZhbDogT2JqZWN0KSB7XG4gICAgcmV0dXJuIGB7ICR7c2VyaWFsaXplVHVwbGUodmFsKX0gfWA7XG4gIH1cbn1cblxuZGVjbGFyZSBnbG9iYWwge1xuICBpbnRlcmZhY2UgU3RyaW5nIHtcbiAgICBleHBlY3RPaygpOiBTdHJpbmc7XG4gICAgZXhwZWN0RXJyKCk6IFN0cmluZztcbiAgICBleHBlY3RTb21lKCk6IFN0cmluZztcbiAgICBleHBlY3ROb25lKCk6IHZvaWQ7XG4gICAgZXhwZWN0Qm9vbCh2YWx1ZTogYm9vbGVhbik6IGJvb2xlYW47XG4gICAgZXhwZWN0VWludCh2YWx1ZTogbnVtYmVyIHwgYmlnaW50KTogYmlnaW50O1xuICAgIGV4cGVjdEludCh2YWx1ZTogbnVtYmVyIHwgYmlnaW50KTogYmlnaW50O1xuICAgIGV4cGVjdEJ1ZmYodmFsdWU6IEFycmF5QnVmZmVyKTogQXJyYXlCdWZmZXI7XG4gICAgZXhwZWN0QXNjaWkodmFsdWU6IFN0cmluZyk6IFN0cmluZztcbiAgICBleHBlY3RVdGY4KHZhbHVlOiBTdHJpbmcpOiBTdHJpbmc7XG4gICAgZXhwZWN0UHJpbmNpcGFsKHZhbHVlOiBTdHJpbmcpOiBTdHJpbmc7XG4gICAgZXhwZWN0TGlzdCgpOiBBcnJheTxTdHJpbmc+O1xuICAgIGV4cGVjdFR1cGxlKCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIH1cblxuICBpbnRlcmZhY2UgQXJyYXk8VD4ge1xuICAgIGV4cGVjdFNUWFRyYW5zZmVyRXZlbnQoXG4gICAgICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgICAgIHNlbmRlcjogU3RyaW5nLFxuICAgICAgcmVjaXBpZW50OiBTdHJpbmcsXG4gICAgKTogT2JqZWN0O1xuICAgIGV4cGVjdEZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50KFxuICAgICAgYW1vdW50OiBOdW1iZXIgfCBiaWdpbnQsXG4gICAgICBzZW5kZXI6IFN0cmluZyxcbiAgICAgIHJlY2lwaWVudDogU3RyaW5nLFxuICAgICAgYXNzZXRJZDogU3RyaW5nLFxuICAgICk6IE9iamVjdDtcbiAgICBleHBlY3RGdW5naWJsZVRva2VuTWludEV2ZW50KFxuICAgICAgYW1vdW50OiBOdW1iZXIgfCBiaWdpbnQsXG4gICAgICByZWNpcGllbnQ6IFN0cmluZyxcbiAgICAgIGFzc2V0SWQ6IFN0cmluZyxcbiAgICApOiBPYmplY3Q7XG4gICAgZXhwZWN0RnVuZ2libGVUb2tlbkJ1cm5FdmVudChcbiAgICAgIGFtb3VudDogTnVtYmVyIHwgYmlnaW50LFxuICAgICAgc2VuZGVyOiBTdHJpbmcsXG4gICAgICBhc3NldElkOiBTdHJpbmcsXG4gICAgKTogT2JqZWN0O1xuICAgIGV4cGVjdFByaW50RXZlbnQoXG4gICAgICBjb250cmFjdF9pZGVudGlmaWVyOiBzdHJpbmcsXG4gICAgICB2YWx1ZTogc3RyaW5nLFxuICAgICk6IE9iamVjdDtcbiAgICBleHBlY3ROb25GdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudChcbiAgICAgIHRva2VuSWQ6IFN0cmluZyxcbiAgICAgIHNlbmRlcjogU3RyaW5nLFxuICAgICAgcmVjaXBpZW50OiBTdHJpbmcsXG4gICAgICBhc3NldEFkZHJlc3M6IFN0cmluZyxcbiAgICAgIGFzc2V0SWQ6IFN0cmluZyxcbiAgICApOiBPYmplY3Q7XG4gICAgZXhwZWN0Tm9uRnVuZ2libGVUb2tlbk1pbnRFdmVudChcbiAgICAgIHRva2VuSWQ6IFN0cmluZyxcbiAgICAgIHJlY2lwaWVudDogU3RyaW5nLFxuICAgICAgYXNzZXRBZGRyZXNzOiBTdHJpbmcsXG4gICAgICBhc3NldElkOiBTdHJpbmcsXG4gICAgKTogT2JqZWN0O1xuICAgIGV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQoXG4gICAgICB0b2tlbklkOiBTdHJpbmcsXG4gICAgICBzZW5kZXI6IFN0cmluZyxcbiAgICAgIGFzc2V0QWRkcmVzczogU3RyaW5nLFxuICAgICAgYXNzZXRJZDogU3RyaW5nLFxuICAgICk6IE9iamVjdDtcbiAgICAvLyBleHBlY3RFdmVudChzZWw6IChlOiBPYmplY3QpID0+IE9iamVjdCk6IE9iamVjdDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb25zdW1lKHNyYzogU3RyaW5nLCBleHBlY3RhdGlvbjogU3RyaW5nLCB3cmFwcGVkOiBib29sZWFuKSB7XG4gIGxldCBkc3QgPSAoXCIgXCIgKyBzcmMpLnNsaWNlKDEpO1xuICBsZXQgc2l6ZSA9IGV4cGVjdGF0aW9uLmxlbmd0aDtcbiAgaWYgKCF3cmFwcGVkICYmIHNyYyAhPT0gZXhwZWN0YXRpb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgJHtncmVlbihleHBlY3RhdGlvbi50b1N0cmluZygpKX0sIGdvdCAke3JlZChzcmMudG9TdHJpbmcoKSl9YCxcbiAgICApO1xuICB9XG4gIGlmICh3cmFwcGVkKSB7XG4gICAgc2l6ZSArPSAyO1xuICB9XG4gIGlmIChkc3QubGVuZ3RoIDwgc2l6ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBFeHBlY3RlZCAke2dyZWVuKGV4cGVjdGF0aW9uLnRvU3RyaW5nKCkpfSwgZ290ICR7cmVkKHNyYy50b1N0cmluZygpKX1gLFxuICAgICk7XG4gIH1cbiAgaWYgKHdyYXBwZWQpIHtcbiAgICBkc3QgPSBkc3Quc3Vic3RyaW5nKDEsIGRzdC5sZW5ndGggLSAxKTtcbiAgfVxuICBsZXQgcmVzID0gZHN0LnNsaWNlKDAsIGV4cGVjdGF0aW9uLmxlbmd0aCk7XG4gIGlmIChyZXMgIT09IGV4cGVjdGF0aW9uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEV4cGVjdGVkICR7Z3JlZW4oZXhwZWN0YXRpb24udG9TdHJpbmcoKSl9LCBnb3QgJHtyZWQoc3JjLnRvU3RyaW5nKCkpfWAsXG4gICAgKTtcbiAgfVxuICBsZXQgbGVmdFBhZCA9IDA7XG4gIGlmIChkc3QuY2hhckF0KGV4cGVjdGF0aW9uLmxlbmd0aCkgPT09IFwiIFwiKSB7XG4gICAgbGVmdFBhZCA9IDE7XG4gIH1cbiAgbGV0IHJlbWFpbmRlciA9IGRzdC5zdWJzdHJpbmcoZXhwZWN0YXRpb24ubGVuZ3RoICsgbGVmdFBhZCk7XG4gIHJldHVybiByZW1haW5kZXI7XG59XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0T2sgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBjb25zdW1lKHRoaXMsIFwib2tcIiwgdHJ1ZSk7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdEVyciA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGNvbnN1bWUodGhpcywgXCJlcnJcIiwgdHJ1ZSk7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdFNvbWUgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBjb25zdW1lKHRoaXMsIFwic29tZVwiLCB0cnVlKTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0Tm9uZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGNvbnN1bWUodGhpcywgXCJub25lXCIsIGZhbHNlKTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0Qm9vbCA9IGZ1bmN0aW9uICh2YWx1ZTogYm9vbGVhbikge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYCR7dmFsdWV9YCwgZmFsc2UpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHRocm93IGVycm9yO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0VWludCA9IGZ1bmN0aW9uICh2YWx1ZTogbnVtYmVyIHwgYmlnaW50KTogYmlnaW50IHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGB1JHt2YWx1ZX1gLCBmYWxzZSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbiAgcmV0dXJuIEJpZ0ludCh2YWx1ZSk7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdEludCA9IGZ1bmN0aW9uICh2YWx1ZTogbnVtYmVyIHwgYmlnaW50KTogYmlnaW50IHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGAke3ZhbHVlfWAsIGZhbHNlKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuICByZXR1cm4gQmlnSW50KHZhbHVlKTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0QnVmZiA9IGZ1bmN0aW9uICh2YWx1ZTogQXJyYXlCdWZmZXIpIHtcbiAgbGV0IGJ1ZmZlciA9IHR5cGVzLmJ1ZmYodmFsdWUpO1xuICBpZiAodGhpcyAhPT0gYnVmZmVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAke2dyZWVuKGJ1ZmZlcil9LCBnb3QgJHtyZWQodGhpcy50b1N0cmluZygpKX1gKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdEFzY2lpID0gZnVuY3Rpb24gKHZhbHVlOiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGBcIiR7dmFsdWV9XCJgLCBmYWxzZSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RVdGY4ID0gZnVuY3Rpb24gKHZhbHVlOiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGB1XCIke3ZhbHVlfVwiYCwgZmFsc2UpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHRocm93IGVycm9yO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0UHJpbmNpcGFsID0gZnVuY3Rpb24gKHZhbHVlOiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGAke3ZhbHVlfWAsIGZhbHNlKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdExpc3QgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmNoYXJBdCgwKSAhPT0gXCJbXCIgfHwgdGhpcy5jaGFyQXQodGhpcy5sZW5ndGggLSAxKSAhPT0gXCJdXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgJHtncmVlbihcIihsaXN0IC4uLilcIil9LCBnb3QgJHtyZWQodGhpcy50b1N0cmluZygpKX1gLFxuICAgICk7XG4gIH1cblxuICBsZXQgc3RhY2sgPSBbXTtcbiAgbGV0IGVsZW1lbnRzID0gW107XG4gIGxldCBzdGFydCA9IDE7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCIsXCIgJiYgc3RhY2subGVuZ3RoID09IDEpIHtcbiAgICAgIGVsZW1lbnRzLnB1c2godGhpcy5zdWJzdHJpbmcoc3RhcnQsIGkpKTtcbiAgICAgIHN0YXJ0ID0gaSArIDI7XG4gICAgfVxuICAgIGlmIChbXCIoXCIsIFwiW1wiLCBcIntcIl0uaW5jbHVkZXModGhpcy5jaGFyQXQoaSkpKSB7XG4gICAgICBzdGFjay5wdXNoKHRoaXMuY2hhckF0KGkpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIilcIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCIoXCIpIHtcbiAgICAgIHN0YWNrLnBvcCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwifVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIntcIikge1xuICAgICAgc3RhY2sucG9wKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCJdXCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwiW1wiKSB7XG4gICAgICBzdGFjay5wb3AoKTtcbiAgICB9XG4gIH1cbiAgbGV0IHJlbWFpbmRlciA9IHRoaXMuc3Vic3RyaW5nKHN0YXJ0LCB0aGlzLmxlbmd0aCAtIDEpO1xuICBpZiAocmVtYWluZGVyLmxlbmd0aCA+IDApIHtcbiAgICBlbGVtZW50cy5wdXNoKHJlbWFpbmRlcik7XG4gIH1cbiAgcmV0dXJuIGVsZW1lbnRzO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RUdXBsZSA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuY2hhckF0KDApICE9PSBcIntcIiB8fCB0aGlzLmNoYXJBdCh0aGlzLmxlbmd0aCAtIDEpICE9PSBcIn1cIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBFeHBlY3RlZCAke2dyZWVuKFwiKHR1cGxlIC4uLilcIil9LCBnb3QgJHtyZWQodGhpcy50b1N0cmluZygpKX1gLFxuICAgICk7XG4gIH1cblxuICBsZXQgc3RhcnQgPSAxO1xuICBsZXQgc3RhY2sgPSBbXTtcbiAgbGV0IGVsZW1lbnRzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCIsXCIgJiYgc3RhY2subGVuZ3RoID09IDEpIHtcbiAgICAgIGVsZW1lbnRzLnB1c2godGhpcy5zdWJzdHJpbmcoc3RhcnQsIGkpKTtcbiAgICAgIHN0YXJ0ID0gaSArIDI7XG4gICAgfVxuICAgIGlmIChbXCIoXCIsIFwiW1wiLCBcIntcIl0uaW5jbHVkZXModGhpcy5jaGFyQXQoaSkpKSB7XG4gICAgICBzdGFjay5wdXNoKHRoaXMuY2hhckF0KGkpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIilcIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCIoXCIpIHtcbiAgICAgIHN0YWNrLnBvcCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwifVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIntcIikge1xuICAgICAgc3RhY2sucG9wKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCJdXCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwiW1wiKSB7XG4gICAgICBzdGFjay5wb3AoKTtcbiAgICB9XG4gIH1cbiAgbGV0IHJlbWFpbmRlciA9IHRoaXMuc3Vic3RyaW5nKHN0YXJ0LCB0aGlzLmxlbmd0aCAtIDEpO1xuICBpZiAocmVtYWluZGVyLmxlbmd0aCA+IDApIHtcbiAgICBlbGVtZW50cy5wdXNoKHJlbWFpbmRlcik7XG4gIH1cblxuICBsZXQgdHVwbGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChsZXQgZWxlbWVudCBvZiBlbGVtZW50cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZWxlbWVudC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGVsZW1lbnQuY2hhckF0KGkpID09PSBcIjpcIikge1xuICAgICAgICBsZXQga2V5OiBzdHJpbmcgPSBlbGVtZW50LnN1YnN0cmluZygwLCBpKTtcbiAgICAgICAgbGV0IHZhbHVlOiBzdHJpbmcgPSBlbGVtZW50LnN1YnN0cmluZyhpICsgMiwgZWxlbWVudC5sZW5ndGgpO1xuICAgICAgICB0dXBsZVtrZXldID0gdmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0dXBsZTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3RTVFhUcmFuc2ZlckV2ZW50ID0gZnVuY3Rpb24gKFxuICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgc2VuZGVyOiBTdHJpbmcsXG4gIHJlY2lwaWVudDogU3RyaW5nLFxuKSB7XG4gIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IGU6IGFueSA9IHt9O1xuICAgICAgZVtcImFtb3VudFwiXSA9IGV2ZW50LnN0eF90cmFuc2Zlcl9ldmVudC5hbW91bnQuZXhwZWN0SW50KGFtb3VudCk7XG4gICAgICBlW1wic2VuZGVyXCJdID0gZXZlbnQuc3R4X3RyYW5zZmVyX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKTtcbiAgICAgIGVbXCJyZWNpcGllbnRcIl0gPSBldmVudC5zdHhfdHJhbnNmZXJfZXZlbnQucmVjaXBpZW50LmV4cGVjdFByaW5jaXBhbChcbiAgICAgICAgcmVjaXBpZW50LFxuICAgICAgKTtcbiAgICAgIHJldHVybiBlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgU1RYVHJhbnNmZXJFdmVudGApO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdEZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50ID0gZnVuY3Rpb24gKFxuICBhbW91bnQ6IE51bWJlcixcbiAgc2VuZGVyOiBTdHJpbmcsXG4gIHJlY2lwaWVudDogU3RyaW5nLFxuICBhc3NldElkOiBTdHJpbmcsXG4pIHtcbiAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgIHRyeSB7XG4gICAgICBsZXQgZTogYW55ID0ge307XG4gICAgICBlW1wiYW1vdW50XCJdID0gZXZlbnQuZnRfdHJhbnNmZXJfZXZlbnQuYW1vdW50LmV4cGVjdEludChhbW91bnQpO1xuICAgICAgZVtcInNlbmRlclwiXSA9IGV2ZW50LmZ0X3RyYW5zZmVyX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKTtcbiAgICAgIGVbXCJyZWNpcGllbnRcIl0gPSBldmVudC5mdF90cmFuc2Zlcl9ldmVudC5yZWNpcGllbnQuZXhwZWN0UHJpbmNpcGFsKFxuICAgICAgICByZWNpcGllbnQsXG4gICAgICApO1xuICAgICAgaWYgKGV2ZW50LmZ0X3RyYW5zZmVyX2V2ZW50LmFzc2V0X2lkZW50aWZpZXIuZW5kc1dpdGgoYXNzZXRJZCkpIHtcbiAgICAgICAgZVtcImFzc2V0SWRcIl0gPSBldmVudC5mdF90cmFuc2Zlcl9ldmVudC5hc3NldF9pZGVudGlmaWVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIEZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50KCR7YW1vdW50fSwgJHtzZW5kZXJ9LCAke3JlY2lwaWVudH0sICR7YXNzZXRJZH0pXFxuJHtcbiAgICAgIEpTT04uc3RyaW5naWZ5KHRoaXMpXG4gICAgfWAsXG4gICk7XG59O1xuXG5BcnJheS5wcm90b3R5cGUuZXhwZWN0RnVuZ2libGVUb2tlbk1pbnRFdmVudCA9IGZ1bmN0aW9uIChcbiAgYW1vdW50OiBOdW1iZXIgfCBiaWdpbnQsXG4gIHJlY2lwaWVudDogU3RyaW5nLFxuICBhc3NldElkOiBTdHJpbmcsXG4pIHtcbiAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgIHRyeSB7XG4gICAgICBsZXQgZTogYW55ID0ge307XG4gICAgICBlW1wiYW1vdW50XCJdID0gZXZlbnQuZnRfbWludF9ldmVudC5hbW91bnQuZXhwZWN0SW50KGFtb3VudCk7XG4gICAgICBlW1wicmVjaXBpZW50XCJdID0gZXZlbnQuZnRfbWludF9ldmVudC5yZWNpcGllbnQuZXhwZWN0UHJpbmNpcGFsKHJlY2lwaWVudCk7XG4gICAgICBpZiAoZXZlbnQuZnRfbWludF9ldmVudC5hc3NldF9pZGVudGlmaWVyLmVuZHNXaXRoKGFzc2V0SWQpKSB7XG4gICAgICAgIGVbXCJhc3NldElkXCJdID0gZXZlbnQuZnRfbWludF9ldmVudC5hc3NldF9pZGVudGlmaWVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIEZ1bmdpYmxlVG9rZW5NaW50RXZlbnRgKTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3RGdW5naWJsZVRva2VuQnVybkV2ZW50ID0gZnVuY3Rpb24gKFxuICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgc2VuZGVyOiBTdHJpbmcsXG4gIGFzc2V0SWQ6IFN0cmluZyxcbikge1xuICBmb3IgKGxldCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBlOiBhbnkgPSB7fTtcbiAgICAgIGVbXCJhbW91bnRcIl0gPSBldmVudC5mdF9idXJuX2V2ZW50LmFtb3VudC5leHBlY3RJbnQoYW1vdW50KTtcbiAgICAgIGVbXCJzZW5kZXJcIl0gPSBldmVudC5mdF9idXJuX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKTtcbiAgICAgIGlmIChldmVudC5mdF9idXJuX2V2ZW50LmFzc2V0X2lkZW50aWZpZXIuZW5kc1dpdGgoYXNzZXRJZCkpIHtcbiAgICAgICAgZVtcImFzc2V0SWRcIl0gPSBldmVudC5mdF9idXJuX2V2ZW50LmFzc2V0X2lkZW50aWZpZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgRnVuZ2libGVUb2tlbkJ1cm5FdmVudGApO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdFByaW50RXZlbnQgPSBmdW5jdGlvbiAoXG4gIGNvbnRyYWN0X2lkZW50aWZpZXI6IHN0cmluZyxcbiAgdmFsdWU6IHN0cmluZyxcbikge1xuICBmb3IgKGxldCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBlOiBhbnkgPSB7fTtcbiAgICAgIGVbXCJjb250cmFjdF9pZGVudGlmaWVyXCJdID0gZXZlbnQuY29udHJhY3RfZXZlbnQuY29udHJhY3RfaWRlbnRpZmllclxuICAgICAgICAuZXhwZWN0UHJpbmNpcGFsKFxuICAgICAgICAgIGNvbnRyYWN0X2lkZW50aWZpZXIsXG4gICAgICAgICk7XG5cbiAgICAgIGlmIChldmVudC5jb250cmFjdF9ldmVudC50b3BpYy5lbmRzV2l0aChcInByaW50XCIpKSB7XG4gICAgICAgIGVbXCJ0b3BpY1wiXSA9IGV2ZW50LmNvbnRyYWN0X2V2ZW50LnRvcGljO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChldmVudC5jb250cmFjdF9ldmVudC52YWx1ZS5lbmRzV2l0aCh2YWx1ZSkpIHtcbiAgICAgICAgZVtcInZhbHVlXCJdID0gZXZlbnQuY29udHJhY3RfZXZlbnQudmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgUHJpbnRFdmVudGApO1xufTtcbi8vIEFycmF5LnByb3RvdHlwZS5leHBlY3RFdmVudCA9IGZ1bmN0aW9uKHNlbDogKGU6IE9iamVjdCkgPT4gT2JqZWN0KSB7XG4vLyAgICAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuLy8gICAgICAgICB0cnkge1xuLy8gICAgICAgICAgICAgc2VsKGV2ZW50KTtcbi8vICAgICAgICAgICAgIHJldHVybiBldmVudCBhcyBPYmplY3Q7XG4vLyAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4vLyAgICAgICAgICAgICBjb250aW51ZTtcbi8vICAgICAgICAgfVxuLy8gICAgIH1cbi8vICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBQcmludEV2ZW50YCk7XG4vLyB9XG5BcnJheS5wcm90b3R5cGUuZXhwZWN0Tm9uRnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQgPSBmdW5jdGlvbiAoXG4gIHRva2VuSWQ6IFN0cmluZyxcbiAgc2VuZGVyOiBTdHJpbmcsXG4gIHJlY2lwaWVudDogU3RyaW5nLFxuICBhc3NldEFkZHJlc3M6IFN0cmluZyxcbiAgYXNzZXRJZDogU3RyaW5nLFxuKSB7XG4gIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IGU6IGFueSA9IHt9O1xuICAgICAgaWYgKGV2ZW50Lm5mdF90cmFuc2Zlcl9ldmVudC52YWx1ZSA9PT0gdG9rZW5JZCkge1xuICAgICAgICBlW1widG9rZW5JZFwiXSA9IGV2ZW50Lm5mdF90cmFuc2Zlcl9ldmVudC52YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgZVtcInNlbmRlclwiXSA9IGV2ZW50Lm5mdF90cmFuc2Zlcl9ldmVudC5zZW5kZXIuZXhwZWN0UHJpbmNpcGFsKHNlbmRlcik7XG4gICAgICBlW1wicmVjaXBpZW50XCJdID0gZXZlbnQubmZ0X3RyYW5zZmVyX2V2ZW50LnJlY2lwaWVudC5leHBlY3RQcmluY2lwYWwoXG4gICAgICAgIHJlY2lwaWVudCxcbiAgICAgICk7XG4gICAgICBpZiAoXG4gICAgICAgIGV2ZW50Lm5mdF90cmFuc2Zlcl9ldmVudC5hc3NldF9pZGVudGlmaWVyID09PVxuICAgICAgICAgIGAke2Fzc2V0QWRkcmVzc306OiR7YXNzZXRJZH1gXG4gICAgICApIHtcbiAgICAgICAgZVtcImFzc2V0SWRcIl0gPSBldmVudC5uZnRfdHJhbnNmZXJfZXZlbnQuYXNzZXRfaWRlbnRpZmllcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBOb25GdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudGApO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5NaW50RXZlbnQgPSBmdW5jdGlvbiAoXG4gIHRva2VuSWQ6IFN0cmluZyxcbiAgcmVjaXBpZW50OiBTdHJpbmcsXG4gIGFzc2V0QWRkcmVzczogU3RyaW5nLFxuICBhc3NldElkOiBTdHJpbmcsXG4pIHtcbiAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgIHRyeSB7XG4gICAgICBsZXQgZTogYW55ID0ge307XG4gICAgICBpZiAoZXZlbnQubmZ0X21pbnRfZXZlbnQudmFsdWUgPT09IHRva2VuSWQpIHtcbiAgICAgICAgZVtcInRva2VuSWRcIl0gPSBldmVudC5uZnRfbWludF9ldmVudC52YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgZVtcInJlY2lwaWVudFwiXSA9IGV2ZW50Lm5mdF9taW50X2V2ZW50LnJlY2lwaWVudC5leHBlY3RQcmluY2lwYWwoXG4gICAgICAgIHJlY2lwaWVudCxcbiAgICAgICk7XG4gICAgICBpZiAoXG4gICAgICAgIGV2ZW50Lm5mdF9taW50X2V2ZW50LmFzc2V0X2lkZW50aWZpZXIgPT09IGAke2Fzc2V0QWRkcmVzc306OiR7YXNzZXRJZH1gXG4gICAgICApIHtcbiAgICAgICAgZVtcImFzc2V0SWRcIl0gPSBldmVudC5uZnRfbWludF9ldmVudC5hc3NldF9pZGVudGlmaWVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIE5vbkZ1bmdpYmxlVG9rZW5NaW50RXZlbnRgKTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3ROb25GdW5naWJsZVRva2VuQnVybkV2ZW50ID0gZnVuY3Rpb24gKFxuICB0b2tlbklkOiBTdHJpbmcsXG4gIHNlbmRlcjogU3RyaW5nLFxuICBhc3NldEFkZHJlc3M6IFN0cmluZyxcbiAgYXNzZXRJZDogU3RyaW5nLFxuKSB7XG4gIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IGU6IGFueSA9IHt9O1xuICAgICAgaWYgKGV2ZW50Lm5mdF9idXJuX2V2ZW50LnZhbHVlID09PSB0b2tlbklkKSB7XG4gICAgICAgIGVbXCJ0b2tlbklkXCJdID0gZXZlbnQubmZ0X2J1cm5fZXZlbnQudmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGVbXCJzZW5kZXJcIl0gPSBldmVudC5uZnRfYnVybl9ldmVudC5zZW5kZXIuZXhwZWN0UHJpbmNpcGFsKHNlbmRlcik7XG4gICAgICBpZiAoXG4gICAgICAgIGV2ZW50Lm5mdF9idXJuX2V2ZW50LmFzc2V0X2lkZW50aWZpZXIgPT09IGAke2Fzc2V0QWRkcmVzc306OiR7YXNzZXRJZH1gXG4gICAgICApIHtcbiAgICAgICAgZVtcImFzc2V0SWRcIl0gPSBldmVudC5uZnRfYnVybl9ldmVudC5hc3NldF9pZGVudGlmaWVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIE5vbkZ1bmdpYmxlVG9rZW5CdXJuRXZlbnRgKTtcbn07XG5cbmNvbnN0IG5vQ29sb3IgPSBnbG9iYWxUaGlzLkRlbm8/Lm5vQ29sb3IgPz8gdHJ1ZTtcblxuaW50ZXJmYWNlIENvZGUge1xuICBvcGVuOiBzdHJpbmc7XG4gIGNsb3NlOiBzdHJpbmc7XG4gIHJlZ2V4cDogUmVnRXhwO1xufVxuXG5sZXQgZW5hYmxlZCA9ICFub0NvbG9yO1xuXG5mdW5jdGlvbiBjb2RlKG9wZW46IG51bWJlcltdLCBjbG9zZTogbnVtYmVyKTogQ29kZSB7XG4gIHJldHVybiB7XG4gICAgb3BlbjogYFxceDFiWyR7b3Blbi5qb2luKFwiO1wiKX1tYCxcbiAgICBjbG9zZTogYFxceDFiWyR7Y2xvc2V9bWAsXG4gICAgcmVnZXhwOiBuZXcgUmVnRXhwKGBcXFxceDFiXFxcXFske2Nsb3NlfW1gLCBcImdcIiksXG4gIH07XG59XG5cbmZ1bmN0aW9uIHJ1bihzdHI6IHN0cmluZywgY29kZTogQ29kZSk6IHN0cmluZyB7XG4gIHJldHVybiBlbmFibGVkXG4gICAgPyBgJHtjb2RlLm9wZW59JHtzdHIucmVwbGFjZShjb2RlLnJlZ2V4cCwgY29kZS5vcGVuKX0ke2NvZGUuY2xvc2V9YFxuICAgIDogc3RyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVkKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJ1bihzdHIsIGNvZGUoWzMxXSwgMzkpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdyZWVuKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJ1bihzdHIsIGNvZGUoWzMyXSwgMzkpKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLE1BQU0sRUFBRTtJQUNiLElBQUksQ0FBUztJQUNiLE1BQU0sQ0FBUztJQUNmLFlBQVksQ0FBa0I7SUFDOUIsV0FBVyxDQUFjO0lBQ3pCLGNBQWMsQ0FBb0I7SUFFbEMsWUFBWSxJQUFZLEVBQUUsTUFBYyxDQUFFO1FBQ3hDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0tBQ3RCO0lBRUQsT0FBTyxXQUFXLENBQUMsTUFBYyxFQUFFLFNBQWlCLEVBQUUsTUFBYyxFQUFFO1FBQ3BFLElBQUksRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQUFBQztRQUMzQixFQUFFLENBQUMsV0FBVyxHQUFHO1lBQ2YsU0FBUztZQUNULE1BQU07U0FDUCxDQUFDO1FBQ0YsT0FBTyxFQUFFLENBQUM7S0FDWDtJQUVELE9BQU8sWUFBWSxDQUNqQixRQUFnQixFQUNoQixNQUFjLEVBQ2QsSUFBbUIsRUFDbkIsTUFBYyxFQUNkO1FBQ0EsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxBQUFDO1FBQzNCLEVBQUUsQ0FBQyxZQUFZLEdBQUc7WUFDaEIsUUFBUTtZQUNSLE1BQU07WUFDTixJQUFJO1NBQ0wsQ0FBQztRQUNGLE9BQU8sRUFBRSxDQUFDO0tBQ1g7SUFFRCxPQUFPLGNB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LENBQUU7UUFDcEMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtZQUMvQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEMsS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDZjtRQUNELElBQUk7WUFBQyxHQUFHO1lBQUUsR0FBRztZQUFFLEdBQUc7U0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDNUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDNUI7UUFDRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUM3RCxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDYjtRQUNELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQzdELEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztTQUNiO1FBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7WUFDN0QsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1NBQ2I7S0FDRjtJQUNELElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxD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