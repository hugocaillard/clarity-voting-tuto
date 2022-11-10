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
        // @ts-ignore
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
        let result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/mine_empty_blocks", {
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
        let result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/call_read_only_fn", {
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
        let result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/get_assets_maps", {
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
        // @ts-ignore
        Deno.test({
            name: options.name,
            only: options.only,
            ignore: options.ignore,
            async fn () {
                let hasPreDeploymentSteps = options.preDeployment !== undefined;
                let result = JSON.parse(// @ts-ignore
                Deno.core.opSync("api/v1/new_session", {
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
                    result = JSON.parse(// @ts-ignore
                    Deno.core.opSync("api/v1/load_deployment", {
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
                // @ts-ignore
                JSON.parse(Deno.core.opSync("api/v1/terminate_session", {
                    sessionId: chain1.sessionId
                }));
            }
        });
    }
    static run(options) {
        // @ts-ignore
        Deno.test({
            name: "running script",
            async fn () {
                let result = JSON.parse(// @ts-ignore
                Deno.core.opSync("api/v1/new_session", {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvY2xhcmluZXRAdjAuMzQuMC9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY2xhc3MgVHgge1xuICB0eXBlOiBudW1iZXI7XG4gIHNlbmRlcjogc3RyaW5nO1xuICBjb250cmFjdENhbGw/OiBUeENvbnRyYWN0Q2FsbDtcbiAgdHJhbnNmZXJTdHg/OiBUeFRyYW5zZmVyO1xuICBkZXBsb3lDb250cmFjdD86IFR4RGVwbG95Q29udHJhY3Q7XG5cbiAgY29uc3RydWN0b3IodHlwZTogbnVtYmVyLCBzZW5kZXI6IHN0cmluZykge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5zZW5kZXIgPSBzZW5kZXI7XG4gIH1cblxuICBzdGF0aWMgdHJhbnNmZXJTVFgoYW1vdW50OiBudW1iZXIsIHJlY2lwaWVudDogc3RyaW5nLCBzZW5kZXI6IHN0cmluZykge1xuICAgIGxldCB0eCA9IG5ldyBUeCgxLCBzZW5kZXIpO1xuICAgIHR4LnRyYW5zZmVyU3R4ID0ge1xuICAgICAgcmVjaXBpZW50LFxuICAgICAgYW1vdW50LFxuICAgIH07XG4gICAgcmV0dXJuIHR4O1xuICB9XG5cbiAgc3RhdGljIGNvbnRyYWN0Q2FsbChcbiAgICBjb250cmFjdDogc3RyaW5nLFxuICAgIG1ldGhvZDogc3RyaW5nLFxuICAgIGFyZ3M6IEFycmF5PHN0cmluZz4sXG4gICAgc2VuZGVyOiBzdHJpbmcsXG4gICkge1xuICAgIGxldCB0eCA9IG5ldyBUeCgyLCBzZW5kZXIpO1xuICAgIHR4LmNvbnRyYWN0Q2FsbCA9IHtcbiAgICAgIGNvbnRyYWN0LFxuICAgICAgbWV0aG9kLFxuICAgICAgYXJncyxcbiAgICB9O1xuICAgIHJldHVybiB0eDtcbiAgfVxuXG4gIHN0YXRpYyBkZXBsb3lDb250cmFjdChuYW1lOiBzdHJpbmcsIGNvZGU6IHN0cmluZywgc2VuZGVyOiBzdHJpbmcpIHtcbiAgICBsZXQgdHggPSBuZXcgVHgoMywgc2VuZGVyKTtcbiAgICB0eC5kZXBsb3lDb250cmFjdCA9IHtcbiAgICAgIG5hbWUsXG4gICAgICBjb2RlLFxuICAgIH07XG4gICAgcmV0dXJuIHR4O1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHhDb250cmFjdENhbGwge1xuICBjb250cmFjdDogc3RyaW5nO1xuICBtZXRob2Q6IHN0cmluZztcbiAgYXJnczogQXJyYXk8c3RyaW5nPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeERlcGxveUNvbnRyYWN0IHtcbiAgY29kZTogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHhUcmFuc2ZlciB7XG4gIGFtb3VudDogbnVtYmVyO1xuICByZWNpcGllbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeFJlY2VpcHQge1xuICByZXN1bHQ6IHN0cmluZztcbiAgZXZlbnRzOiBBcnJheTxhbnk+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJsb2NrIHtcbiAgaGVpZ2h0OiBudW1iZXI7XG4gIHJlY2VpcHRzOiBBcnJheTxUeFJlY2VpcHQ+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFjY291bnQge1xuICBhZGRyZXNzOiBzdHJpbmc7XG4gIGJhbGFuY2U6IG51bWJlcjtcbiAgbmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENoYWluIHtcbiAgc2Vzc2lvbklkOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZE9ubHlGbiB7XG4gIHNlc3Npb25faWQ6IG51bWJlcjtcbiAgcmVzdWx0OiBzdHJpbmc7XG4gIGV2ZW50czogQXJyYXk8YW55Pjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFbXB0eUJsb2NrIHtcbiAgc2Vzc2lvbl9pZDogbnVtYmVyO1xuICBibG9ja19oZWlnaHQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBc3NldHNNYXBzIHtcbiAgc2Vzc2lvbl9pZDogbnVtYmVyO1xuICBhc3NldHM6IHtcbiAgICBbbmFtZTogc3RyaW5nXToge1xuICAgICAgW293bmVyOiBzdHJpbmddOiBudW1iZXI7XG4gICAgfTtcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIENoYWluIHtcbiAgc2Vzc2lvbklkOiBudW1iZXI7XG4gIGJsb2NrSGVpZ2h0OiBudW1iZXIgPSAxO1xuXG4gIGNvbnN0cnVjdG9yKHNlc3Npb25JZDogbnVtYmVyKSB7XG4gICAgdGhpcy5zZXNzaW9uSWQgPSBzZXNzaW9uSWQ7XG4gIH1cblxuICBtaW5lQmxvY2sodHJhbnNhY3Rpb25zOiBBcnJheTxUeD4pOiBCbG9jayB7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKERlbm8uY29yZS5vcFN5bmMoXCJhcGkvdjEvbWluZV9ibG9ja1wiLCB7XG4gICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgICAgdHJhbnNhY3Rpb25zOiB0cmFuc2FjdGlvbnMsXG4gICAgfSkpO1xuICAgIHRoaXMuYmxvY2tIZWlnaHQgPSByZXN1bHQuYmxvY2tfaGVpZ2h0O1xuICAgIGxldCBibG9jazogQmxvY2sgPSB7XG4gICAgICBoZWlnaHQ6IHJlc3VsdC5ibG9ja19oZWlnaHQsXG4gICAgICByZWNlaXB0czogcmVzdWx0LnJlY2VpcHRzLFxuICAgIH07XG4gICAgcmV0dXJuIGJsb2NrO1xuICB9XG5cbiAgbWluZUVtcHR5QmxvY2soY291bnQ6IG51bWJlcik6IEVtcHR5QmxvY2sge1xuICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS9taW5lX2VtcHR5X2Jsb2Nrc1wiLCB7XG4gICAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXG4gICAgICAgIGNvdW50OiBjb3VudCxcbiAgICAgIH0pLFxuICAgICk7XG4gICAgdGhpcy5ibG9ja0hlaWdodCA9IHJlc3VsdC5ibG9ja19oZWlnaHQ7XG4gICAgbGV0IGVtcHR5QmxvY2s6IEVtcHR5QmxvY2sgPSB7XG4gICAgICBzZXNzaW9uX2lkOiByZXN1bHQuc2Vzc2lvbl9pZCxcbiAgICAgIGJsb2NrX2hlaWdodDogcmVzdWx0LmJsb2NrX2hlaWdodCxcbiAgICB9O1xuICAgIHJldHVybiBlbXB0eUJsb2NrO1xuICB9XG5cbiAgbWluZUVtcHR5QmxvY2tVbnRpbCh0YXJnZXRCbG9ja0hlaWdodDogbnVtYmVyKTogRW1wdHlCbG9jayB7XG4gICAgbGV0IGNvdW50ID0gdGFyZ2V0QmxvY2tIZWlnaHQgLSB0aGlzLmJsb2NrSGVpZ2h0O1xuICAgIGlmIChjb3VudCA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYENoYWluIHRpcCBjYW5ub3QgYmUgbW92ZWQgZnJvbSAke3RoaXMuYmxvY2tIZWlnaHR9IHRvICR7dGFyZ2V0QmxvY2tIZWlnaHR9YCxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1pbmVFbXB0eUJsb2NrKGNvdW50KTtcbiAgfVxuXG4gIGNhbGxSZWFkT25seUZuKFxuICAgIGNvbnRyYWN0OiBzdHJpbmcsXG4gICAgbWV0aG9kOiBzdHJpbmcsXG4gICAgYXJnczogQXJyYXk8YW55PixcbiAgICBzZW5kZXI6IHN0cmluZyxcbiAgKTogUmVhZE9ubHlGbiB7XG4gICAgbGV0IHJlc3VsdCA9IEpTT04ucGFyc2UoXG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBEZW5vLmNvcmUub3BTeW5jKFwiYXBpL3YxL2NhbGxfcmVhZF9vbmx5X2ZuXCIsIHtcbiAgICAgICAgc2Vzc2lvbklkOiB0aGlzLnNlc3Npb25JZCxcbiAgICAgICAgY29udHJhY3Q6IGNvbnRyYWN0LFxuICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgYXJnczogYXJncyxcbiAgICAgICAgc2VuZGVyOiBzZW5kZXIsXG4gICAgICB9KSxcbiAgICApO1xuICAgIGxldCByZWFkT25seUZuOiBSZWFkT25seUZuID0ge1xuICAgICAgc2Vzc2lvbl9pZDogcmVzdWx0LnNlc3Npb25faWQsXG4gICAgICByZXN1bHQ6IHJlc3VsdC5yZXN1bHQsXG4gICAgICBldmVudHM6IHJlc3VsdC5ldmVudHMsXG4gICAgfTtcbiAgICByZXR1cm4gcmVhZE9ubHlGbjtcbiAgfVxuXG4gIGdldEFzc2V0c01hcHMoKTogQXNzZXRzTWFwcyB7XG4gICAgbGV0IHJlc3VsdCA9IEpTT04ucGFyc2UoXG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBEZW5vLmNvcmUub3BTeW5jKFwiYXBpL3YxL2dldF9hc3NldHNfbWFwc1wiLCB7XG4gICAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXG4gICAgICB9KSxcbiAgICApO1xuICAgIGxldCBhc3NldHNNYXBzOiBBc3NldHNNYXBzID0ge1xuICAgICAgc2Vzc2lvbl9pZDogcmVzdWx0LnNlc3Npb25faWQsXG4gICAgICBhc3NldHM6IHJlc3VsdC5hc3NldHMsXG4gICAgfTtcbiAgICByZXR1cm4gYXNzZXRzTWFwcztcbiAgfVxufVxuXG50eXBlIFByZURlcGxveW1lbnRGdW5jdGlvbiA9IChcbiAgY2hhaW46IENoYWluLFxuICBhY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD4sXG4pID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG50eXBlIFRlc3RGdW5jdGlvbiA9IChcbiAgY2hhaW46IENoYWluLFxuICBhY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD4sXG4gIGNvbnRyYWN0czogTWFwPHN0cmluZywgQ29udHJhY3Q+LFxuKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbnR5cGUgUHJlU2V0dXBGdW5jdGlvbiA9ICgpID0+IEFycmF5PFR4PjtcblxuaW50ZXJmYWNlIFVuaXRUZXN0T3B0aW9ucyB7XG4gIG5hbWU6IHN0cmluZztcbiAgb25seT86IHRydWU7XG4gIGlnbm9yZT86IHRydWU7XG4gIGRlcGxveW1lbnRQYXRoPzogc3RyaW5nO1xuICBwcmVEZXBsb3ltZW50PzogUHJlRGVwbG95bWVudEZ1bmN0aW9uO1xuICBmbjogVGVzdEZ1bmN0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbnRyYWN0IHtcbiAgY29udHJhY3RfaWQ6IHN0cmluZztcbiAgc291cmNlOiBzdHJpbmc7XG4gIGNvbnRyYWN0X2ludGVyZmFjZTogYW55O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0YWNrc05vZGUge1xuICB1cmw6IHN0cmluZztcbn1cblxudHlwZSBTY3JpcHRGdW5jdGlvbiA9IChcbiAgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+LFxuICBjb250cmFjdHM6IE1hcDxzdHJpbmcsIENvbnRyYWN0PixcbiAgbm9kZTogU3RhY2tzTm9kZSxcbikgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbmludGVyZmFjZSBTY3JpcHRPcHRpb25zIHtcbiAgZm46IFNjcmlwdEZ1bmN0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgQ2xhcmluZXQge1xuICBzdGF0aWMgdGVzdChvcHRpb25zOiBVbml0VGVzdE9wdGlvbnMpIHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgRGVuby50ZXN0KHtcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIG9ubHk6IG9wdGlvbnMub25seSxcbiAgICAgIGlnbm9yZTogb3B0aW9ucy5pZ25vcmUsXG4gICAgICBhc3luYyBmbigpIHtcbiAgICAgICAgbGV0IGhhc1ByZURlcGxveW1lbnRTdGVwcyA9IG9wdGlvbnMucHJlRGVwbG95bWVudCAhPT0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICBEZW5vLmNvcmUub3BTeW5jKFwiYXBpL3YxL25ld19zZXNzaW9uXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgICAgICAgIGxvYWREZXBsb3ltZW50OiAhaGFzUHJlRGVwbG95bWVudFN0ZXBzLFxuICAgICAgICAgICAgZGVwbG95bWVudFBhdGg6IG9wdGlvbnMuZGVwbG95bWVudFBhdGgsXG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucHJlRGVwbG95bWVudCkge1xuICAgICAgICAgIGxldCBjaGFpbiA9IG5ldyBDaGFpbihyZXN1bHRbXCJzZXNzaW9uX2lkXCJdKTtcbiAgICAgICAgICBsZXQgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+ID0gbmV3IE1hcCgpO1xuICAgICAgICAgIGZvciAobGV0IGFjY291bnQgb2YgcmVzdWx0W1wiYWNjb3VudHNcIl0pIHtcbiAgICAgICAgICAgIGFjY291bnRzLnNldChhY2NvdW50Lm5hbWUsIGFjY291bnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhd2FpdCBvcHRpb25zLnByZURlcGxveW1lbnQoY2hhaW4sIGFjY291bnRzKTtcblxuICAgICAgICAgIHJlc3VsdCA9IEpTT04ucGFyc2UoXG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBEZW5vLmNvcmUub3BTeW5jKFwiYXBpL3YxL2xvYWRfZGVwbG95bWVudFwiLCB7XG4gICAgICAgICAgICAgIHNlc3Npb25JZDogY2hhaW4uc2Vzc2lvbklkLFxuICAgICAgICAgICAgICBkZXBsb3ltZW50UGF0aDogb3B0aW9ucy5kZXBsb3ltZW50UGF0aCxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY2hhaW4gPSBuZXcgQ2hhaW4ocmVzdWx0W1wic2Vzc2lvbl9pZFwiXSk7XG4gICAgICAgIGxldCBhY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD4gPSBuZXcgTWFwKCk7XG4gICAgICAgIGZvciAobGV0IGFjY291bnQgb2YgcmVzdWx0W1wiYWNjb3VudHNcIl0pIHtcbiAgICAgICAgICBhY2NvdW50cy5zZXQoYWNjb3VudC5uYW1lLCBhY2NvdW50KTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD4gPSBuZXcgTWFwKCk7XG4gICAgICAgIGZvciAobGV0IGNvbnRyYWN0IG9mIHJlc3VsdFtcImNvbnRyYWN0c1wiXSkge1xuICAgICAgICAgIGNvbnRyYWN0cy5zZXQoY29udHJhY3QuY29udHJhY3RfaWQsIGNvbnRyYWN0KTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBvcHRpb25zLmZuKGNoYWluLCBhY2NvdW50cywgY29udHJhY3RzKTtcblxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIEpTT04ucGFyc2UoRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS90ZXJtaW5hdGVfc2Vzc2lvblwiLCB7XG4gICAgICAgICAgc2Vzc2lvbklkOiBjaGFpbi5zZXNzaW9uSWQsXG4gICAgICAgIH0pKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBzdGF0aWMgcnVuKG9wdGlvbnM6IFNjcmlwdE9wdGlvbnMpIHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgRGVuby50ZXN0KHtcbiAgICAgIG5hbWU6IFwicnVubmluZyBzY3JpcHRcIixcbiAgICAgIGFzeW5jIGZuKCkge1xuICAgICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS9uZXdfc2Vzc2lvblwiLCB7XG4gICAgICAgICAgICBuYW1lOiBcInJ1bm5pbmcgc2NyaXB0XCIsXG4gICAgICAgICAgICBsb2FkRGVwbG95bWVudDogdHJ1ZSxcbiAgICAgICAgICAgIGRlcGxveW1lbnRQYXRoOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICAgIGxldCBhY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD4gPSBuZXcgTWFwKCk7XG4gICAgICAgIGZvciAobGV0IGFjY291bnQgb2YgcmVzdWx0W1wiYWNjb3VudHNcIl0pIHtcbiAgICAgICAgICBhY2NvdW50cy5zZXQoYWNjb3VudC5uYW1lLCBhY2NvdW50KTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD4gPSBuZXcgTWFwKCk7XG4gICAgICAgIGZvciAobGV0IGNvbnRyYWN0IG9mIHJlc3VsdFtcImNvbnRyYWN0c1wiXSkge1xuICAgICAgICAgIGNvbnRyYWN0cy5zZXQoY29udHJhY3QuY29udHJhY3RfaWQsIGNvbnRyYWN0KTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc3RhY2tzX25vZGU6IFN0YWNrc05vZGUgPSB7XG4gICAgICAgICAgdXJsOiByZXN1bHRbXCJzdGFja3Nfbm9kZV91cmxcIl0sXG4gICAgICAgIH07XG4gICAgICAgIGF3YWl0IG9wdGlvbnMuZm4oYWNjb3VudHMsIGNvbnRyYWN0cywgc3RhY2tzX25vZGUpO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIHR5cGVzIHtcbiAgY29uc3QgYnl0ZVRvSGV4OiBhbnkgPSBbXTtcbiAgZm9yIChsZXQgbiA9IDA7IG4gPD0gMHhmZjsgKytuKSB7XG4gICAgY29uc3QgaGV4T2N0ZXQgPSBuLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCBcIjBcIik7XG4gICAgYnl0ZVRvSGV4LnB1c2goaGV4T2N0ZXQpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2VyaWFsaXplVHVwbGUoaW5wdXQ6IE9iamVjdCkge1xuICAgIGxldCBpdGVtczogQXJyYXk8c3RyaW5nPiA9IFtdO1xuICAgIGZvciAodmFyIFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhpbnB1dCkpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgaXRlbXMucHVzaChgJHtrZXl9OiB7ICR7c2VyaWFsaXplVHVwbGUodmFsdWUpfSB9YCk7XG4gICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIC8vIHRvZG8obHVkbyk6IG5vdCBzdXBwb3J0ZWQsIHNob3VsZCBwYW5pY1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaXRlbXMucHVzaChgJHtrZXl9OiAke3ZhbHVlfWApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXMuam9pbihcIiwgXCIpO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNPYmplY3Qob2JqOiBhbnkpIHtcbiAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gXCJvYmplY3RcIiAmJiAhQXJyYXkuaXNBcnJheShvYmopO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIG9rKHZhbDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAob2sgJHt2YWx9KWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gZXJyKHZhbDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAoZXJyICR7dmFsfSlgO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIHNvbWUodmFsOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gYChzb21lICR7dmFsfSlgO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIG5vbmUoKSB7XG4gICAgcmV0dXJuIGBub25lYDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBib29sKHZhbDogYm9vbGVhbikge1xuICAgIHJldHVybiBgJHt2YWx9YDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBpbnQodmFsOiBudW1iZXIgfCBiaWdpbnQpIHtcbiAgICByZXR1cm4gYCR7dmFsfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gdWludCh2YWw6IG51bWJlciB8IGJpZ2ludCkge1xuICAgIHJldHVybiBgdSR7dmFsfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gYXNjaWkodmFsOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsKTtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiB1dGY4KHZhbDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGB1JHtKU09OLnN0cmluZ2lmeSh2YWwpfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gYnVmZih2YWw6IEFycmF5QnVmZmVyIHwgc3RyaW5nKSB7XG4gICAgY29uc3QgYnVmZiA9IHR5cGVvZiB2YWwgPT0gXCJzdHJpbmdcIlxuICAgICAgPyBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUodmFsKVxuICAgICAgOiBuZXcgVWludDhBcnJheSh2YWwpO1xuXG4gICAgY29uc3QgaGV4T2N0ZXRzID0gbmV3IEFycmF5KGJ1ZmYubGVuZ3RoKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYnVmZi5sZW5ndGg7ICsraSkge1xuICAgICAgaGV4T2N0ZXRzW2ldID0gYnl0ZVRvSGV4W2J1ZmZbaV1dO1xuICAgIH1cblxuICAgIHJldHVybiBgMHgke2hleE9jdGV0cy5qb2luKFwiXCIpfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gbGlzdCh2YWw6IEFycmF5PGFueT4pIHtcbiAgICByZXR1cm4gYChsaXN0ICR7dmFsLmpvaW4oXCIgXCIpfSlgO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIHByaW5jaXBhbCh2YWw6IHN0cmluZykge1xuICAgIHJldHVybiBgJyR7dmFsfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gdHVwbGUodmFsOiBPYmplY3QpIHtcbiAgICByZXR1cm4gYHsgJHtzZXJpYWxpemVUdXBsZSh2YWwpfSB9YDtcbiAgfVxufVxuXG5kZWNsYXJlIGdsb2JhbCB7XG4gIGludGVyZmFjZSBTdHJpbmcge1xuICAgIGV4cGVjdE9rKCk6IFN0cmluZztcbiAgICBleHBlY3RFcnIoKTogU3RyaW5nO1xuICAgIGV4cGVjdFNvbWUoKTogU3RyaW5nO1xuICAgIGV4cGVjdE5vbmUoKTogdm9pZDtcbiAgICBleHBlY3RCb29sKHZhbHVlOiBib29sZWFuKTogYm9vbGVhbjtcbiAgICBleHBlY3RVaW50KHZhbHVlOiBudW1iZXIgfCBiaWdpbnQpOiBiaWdpbnQ7XG4gICAgZXhwZWN0SW50KHZhbHVlOiBudW1iZXIgfCBiaWdpbnQpOiBiaWdpbnQ7XG4gICAgZXhwZWN0QnVmZih2YWx1ZTogQXJyYXlCdWZmZXIpOiBBcnJheUJ1ZmZlcjtcbiAgICBleHBlY3RBc2NpaSh2YWx1ZTogU3RyaW5nKTogU3RyaW5nO1xuICAgIGV4cGVjdFV0ZjgodmFsdWU6IFN0cmluZyk6IFN0cmluZztcbiAgICBleHBlY3RQcmluY2lwYWwodmFsdWU6IFN0cmluZyk6IFN0cmluZztcbiAgICBleHBlY3RMaXN0KCk6IEFycmF5PFN0cmluZz47XG4gICAgZXhwZWN0VHVwbGUoKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgfVxuXG4gIGludGVyZmFjZSBBcnJheTxUPiB7XG4gICAgZXhwZWN0U1RYVHJhbnNmZXJFdmVudChcbiAgICAgIGFtb3VudDogTnVtYmVyIHwgYmlnaW50LFxuICAgICAgc2VuZGVyOiBTdHJpbmcsXG4gICAgICByZWNpcGllbnQ6IFN0cmluZyxcbiAgICApOiBPYmplY3Q7XG4gICAgZXhwZWN0RnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQoXG4gICAgICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgICAgIHNlbmRlcjogU3RyaW5nLFxuICAgICAgcmVjaXBpZW50OiBTdHJpbmcsXG4gICAgICBhc3NldElkOiBTdHJpbmcsXG4gICAgKTogT2JqZWN0O1xuICAgIGV4cGVjdEZ1bmdpYmxlVG9rZW5NaW50RXZlbnQoXG4gICAgICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgICAgIHJlY2lwaWVudDogU3RyaW5nLFxuICAgICAgYXNzZXRJZDogU3RyaW5nLFxuICAgICk6IE9iamVjdDtcbiAgICBleHBlY3RGdW5naWJsZVRva2VuQnVybkV2ZW50KFxuICAgICAgYW1vdW50OiBOdW1iZXIgfCBiaWdpbnQsXG4gICAgICBzZW5kZXI6IFN0cmluZyxcbiAgICAgIGFzc2V0SWQ6IFN0cmluZyxcbiAgICApOiBPYmplY3Q7XG4gICAgZXhwZWN0UHJpbnRFdmVudChcbiAgICAgIGNvbnRyYWN0X2lkZW50aWZpZXI6IHN0cmluZyxcbiAgICAgIHZhbHVlOiBzdHJpbmcsXG4gICAgKTogT2JqZWN0O1xuICAgIGV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50KFxuICAgICAgdG9rZW5JZDogU3RyaW5nLFxuICAgICAgc2VuZGVyOiBTdHJpbmcsXG4gICAgICByZWNpcGllbnQ6IFN0cmluZyxcbiAgICAgIGFzc2V0QWRkcmVzczogU3RyaW5nLFxuICAgICAgYXNzZXRJZDogU3RyaW5nLFxuICAgICk6IE9iamVjdDtcbiAgICBleHBlY3ROb25GdW5naWJsZVRva2VuTWludEV2ZW50KFxuICAgICAgdG9rZW5JZDogU3RyaW5nLFxuICAgICAgcmVjaXBpZW50OiBTdHJpbmcsXG4gICAgICBhc3NldEFkZHJlc3M6IFN0cmluZyxcbiAgICAgIGFzc2V0SWQ6IFN0cmluZyxcbiAgICApOiBPYmplY3Q7XG4gICAgZXhwZWN0Tm9uRnVuZ2libGVUb2tlbkJ1cm5FdmVudChcbiAgICAgIHRva2VuSWQ6IFN0cmluZyxcbiAgICAgIHNlbmRlcjogU3RyaW5nLFxuICAgICAgYXNzZXRBZGRyZXNzOiBTdHJpbmcsXG4gICAgICBhc3NldElkOiBTdHJpbmcsXG4gICAgKTogT2JqZWN0O1xuICAgIC8vIGV4cGVjdEV2ZW50KHNlbDogKGU6IE9iamVjdCkgPT4gT2JqZWN0KTogT2JqZWN0O1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnN1bWUoc3JjOiBTdHJpbmcsIGV4cGVjdGF0aW9uOiBTdHJpbmcsIHdyYXBwZWQ6IGJvb2xlYW4pIHtcbiAgbGV0IGRzdCA9IChcIiBcIiArIHNyYykuc2xpY2UoMSk7XG4gIGxldCBzaXplID0gZXhwZWN0YXRpb24ubGVuZ3RoO1xuICBpZiAoIXdyYXBwZWQgJiYgc3JjICE9PSBleHBlY3RhdGlvbikge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBFeHBlY3RlZCAke2dyZWVuKGV4cGVjdGF0aW9uLnRvU3RyaW5nKCkpfSwgZ290ICR7cmVkKHNyYy50b1N0cmluZygpKX1gLFxuICAgICk7XG4gIH1cbiAgaWYgKHdyYXBwZWQpIHtcbiAgICBzaXplICs9IDI7XG4gIH1cbiAgaWYgKGRzdC5sZW5ndGggPCBzaXplKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEV4cGVjdGVkICR7Z3JlZW4oZXhwZWN0YXRpb24udG9TdHJpbmcoKSl9LCBnb3QgJHtyZWQoc3JjLnRvU3RyaW5nKCkpfWAsXG4gICAgKTtcbiAgfVxuICBpZiAod3JhcHBlZCkge1xuICAgIGRzdCA9IGRzdC5zdWJzdHJpbmcoMSwgZHN0Lmxlbmd0aCAtIDEpO1xuICB9XG4gIGxldCByZXMgPSBkc3Quc2xpY2UoMCwgZXhwZWN0YXRpb24ubGVuZ3RoKTtcbiAgaWYgKHJlcyAhPT0gZXhwZWN0YXRpb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgJHtncmVlbihleHBlY3RhdGlvbi50b1N0cmluZygpKX0sIGdvdCAke3JlZChzcmMudG9TdHJpbmcoKSl9YCxcbiAgICApO1xuICB9XG4gIGxldCBsZWZ0UGFkID0gMDtcbiAgaWYgKGRzdC5jaGFyQXQoZXhwZWN0YXRpb24ubGVuZ3RoKSA9PT0gXCIgXCIpIHtcbiAgICBsZWZ0UGFkID0gMTtcbiAgfVxuICBsZXQgcmVtYWluZGVyID0gZHN0LnN1YnN0cmluZyhleHBlY3RhdGlvbi5sZW5ndGggKyBsZWZ0UGFkKTtcbiAgcmV0dXJuIHJlbWFpbmRlcjtcbn1cblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RPayA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGNvbnN1bWUodGhpcywgXCJva1wiLCB0cnVlKTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0RXJyID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gY29uc3VtZSh0aGlzLCBcImVyclwiLCB0cnVlKTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0U29tZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGNvbnN1bWUodGhpcywgXCJzb21lXCIsIHRydWUpO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3ROb25lID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gY29uc3VtZSh0aGlzLCBcIm5vbmVcIiwgZmFsc2UpO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RCb29sID0gZnVuY3Rpb24gKHZhbHVlOiBib29sZWFuKSB7XG4gIHRyeSB7XG4gICAgY29uc3VtZSh0aGlzLCBgJHt2YWx1ZX1gLCBmYWxzZSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RVaW50ID0gZnVuY3Rpb24gKHZhbHVlOiBudW1iZXIgfCBiaWdpbnQpOiBiaWdpbnQge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYHUke3ZhbHVlfWAsIGZhbHNlKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuICByZXR1cm4gQmlnSW50KHZhbHVlKTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0SW50ID0gZnVuY3Rpb24gKHZhbHVlOiBudW1iZXIgfCBiaWdpbnQpOiBiaWdpbnQge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYCR7dmFsdWV9YCwgZmFsc2UpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHRocm93IGVycm9yO1xuICB9XG4gIHJldHVybiBCaWdJbnQodmFsdWUpO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RCdWZmID0gZnVuY3Rpb24gKHZhbHVlOiBBcnJheUJ1ZmZlcikge1xuICBsZXQgYnVmZmVyID0gdHlwZXMuYnVmZih2YWx1ZSk7XG4gIGlmICh0aGlzICE9PSBidWZmZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7Z3JlZW4oYnVmZmVyKX0sIGdvdCAke3JlZCh0aGlzLnRvU3RyaW5nKCkpfWApO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0QXNjaWkgPSBmdW5jdGlvbiAodmFsdWU6IHN0cmluZykge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYFwiJHt2YWx1ZX1cImAsIGZhbHNlKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdFV0ZjggPSBmdW5jdGlvbiAodmFsdWU6IHN0cmluZykge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYHVcIiR7dmFsdWV9XCJgLCBmYWxzZSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RQcmluY2lwYWwgPSBmdW5jdGlvbiAodmFsdWU6IHN0cmluZykge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYCR7dmFsdWV9YCwgZmFsc2UpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHRocm93IGVycm9yO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0TGlzdCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuY2hhckF0KDApICE9PSBcIltcIiB8fCB0aGlzLmNoYXJBdCh0aGlzLmxlbmd0aCAtIDEpICE9PSBcIl1cIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBFeHBlY3RlZCAke2dyZWVuKFwiKGxpc3QgLi4uKVwiKX0sIGdvdCAke3JlZCh0aGlzLnRvU3RyaW5nKCkpfWAsXG4gICAgKTtcbiAgfVxuXG4gIGxldCBzdGFjayA9IFtdO1xuICBsZXQgZWxlbWVudHMgPSBbXTtcbiAgbGV0IHN0YXJ0ID0gMTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIixcIiAmJiBzdGFjay5sZW5ndGggPT0gMSkge1xuICAgICAgZWxlbWVudHMucHVzaCh0aGlzLnN1YnN0cmluZyhzdGFydCwgaSkpO1xuICAgICAgc3RhcnQgPSBpICsgMjtcbiAgICB9XG4gICAgaWYgKFtcIihcIiwgXCJbXCIsIFwie1wiXS5pbmNsdWRlcyh0aGlzLmNoYXJBdChpKSkpIHtcbiAgICAgIHN0YWNrLnB1c2godGhpcy5jaGFyQXQoaSkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwiKVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIihcIikge1xuICAgICAgc3RhY2sucG9wKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCJ9XCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwie1wiKSB7XG4gICAgICBzdGFjay5wb3AoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIl1cIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCJbXCIpIHtcbiAgICAgIHN0YWNrLnBvcCgpO1xuICAgIH1cbiAgfVxuICBsZXQgcmVtYWluZGVyID0gdGhpcy5zdWJzdHJpbmcoc3RhcnQsIHRoaXMubGVuZ3RoIC0gMSk7XG4gIGlmIChyZW1haW5kZXIubGVuZ3RoID4gMCkge1xuICAgIGVsZW1lbnRzLnB1c2gocmVtYWluZGVyKTtcbiAgfVxuICByZXR1cm4gZWxlbWVudHM7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdFR1cGxlID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5jaGFyQXQoMCkgIT09IFwie1wiIHx8IHRoaXMuY2hhckF0KHRoaXMubGVuZ3RoIC0gMSkgIT09IFwifVwiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEV4cGVjdGVkICR7Z3JlZW4oXCIodHVwbGUgLi4uKVwiKX0sIGdvdCAke3JlZCh0aGlzLnRvU3RyaW5nKCkpfWAsXG4gICAgKTtcbiAgfVxuXG4gIGxldCBzdGFydCA9IDE7XG4gIGxldCBzdGFjayA9IFtdO1xuICBsZXQgZWxlbWVudHMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIixcIiAmJiBzdGFjay5sZW5ndGggPT0gMSkge1xuICAgICAgZWxlbWVudHMucHVzaCh0aGlzLnN1YnN0cmluZyhzdGFydCwgaSkpO1xuICAgICAgc3RhcnQgPSBpICsgMjtcbiAgICB9XG4gICAgaWYgKFtcIihcIiwgXCJbXCIsIFwie1wiXS5pbmNsdWRlcyh0aGlzLmNoYXJBdChpKSkpIHtcbiAgICAgIHN0YWNrLnB1c2godGhpcy5jaGFyQXQoaSkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwiKVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIihcIikge1xuICAgICAgc3RhY2sucG9wKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCJ9XCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwie1wiKSB7XG4gICAgICBzdGFjay5wb3AoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIl1cIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCJbXCIpIHtcbiAgICAgIHN0YWNrLnBvcCgpO1xuICAgIH1cbiAgfVxuICBsZXQgcmVtYWluZGVyID0gdGhpcy5zdWJzdHJpbmcoc3RhcnQsIHRoaXMubGVuZ3RoIC0gMSk7XG4gIGlmIChyZW1haW5kZXIubGVuZ3RoID4gMCkge1xuICAgIGVsZW1lbnRzLnB1c2gocmVtYWluZGVyKTtcbiAgfVxuXG4gIGxldCB0dXBsZTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBmb3IgKGxldCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbGVtZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoZWxlbWVudC5jaGFyQXQoaSkgPT09IFwiOlwiKSB7XG4gICAgICAgIGxldCBrZXk6IHN0cmluZyA9IGVsZW1lbnQuc3Vic3RyaW5nKDAsIGkpO1xuICAgICAgICBsZXQgdmFsdWU6IHN0cmluZyA9IGVsZW1lbnQuc3Vic3RyaW5nKGkgKyAyLCBlbGVtZW50Lmxlbmd0aCk7XG4gICAgICAgIHR1cGxlW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHR1cGxlO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdFNUWFRyYW5zZmVyRXZlbnQgPSBmdW5jdGlvbiAoXG4gIGFtb3VudDogTnVtYmVyIHwgYmlnaW50LFxuICBzZW5kZXI6IFN0cmluZyxcbiAgcmVjaXBpZW50OiBTdHJpbmcsXG4pIHtcbiAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgIHRyeSB7XG4gICAgICBsZXQgZTogYW55ID0ge307XG4gICAgICBlW1wiYW1vdW50XCJdID0gZXZlbnQuc3R4X3RyYW5zZmVyX2V2ZW50LmFtb3VudC5leHBlY3RJbnQoYW1vdW50KTtcbiAgICAgIGVbXCJzZW5kZXJcIl0gPSBldmVudC5zdHhfdHJhbnNmZXJfZXZlbnQuc2VuZGVyLmV4cGVjdFByaW5jaXBhbChzZW5kZXIpO1xuICAgICAgZVtcInJlY2lwaWVudFwiXSA9IGV2ZW50LnN0eF90cmFuc2Zlcl9ldmVudC5yZWNpcGllbnQuZXhwZWN0UHJpbmNpcGFsKFxuICAgICAgICByZWNpcGllbnQsXG4gICAgICApO1xuICAgICAgcmV0dXJuIGU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBTVFhUcmFuc2ZlckV2ZW50YCk7XG59O1xuXG5BcnJheS5wcm90b3R5cGUuZXhwZWN0RnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQgPSBmdW5jdGlvbiAoXG4gIGFtb3VudDogTnVtYmVyLFxuICBzZW5kZXI6IFN0cmluZyxcbiAgcmVjaXBpZW50OiBTdHJpbmcsXG4gIGFzc2V0SWQ6IFN0cmluZyxcbikge1xuICBmb3IgKGxldCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBlOiBhbnkgPSB7fTtcbiAgICAgIGVbXCJhbW91bnRcIl0gPSBldmVudC5mdF90cmFuc2Zlcl9ldmVudC5hbW91bnQuZXhwZWN0SW50KGFtb3VudCk7XG4gICAgICBlW1wic2VuZGVyXCJdID0gZXZlbnQuZnRfdHJhbnNmZXJfZXZlbnQuc2VuZGVyLmV4cGVjdFByaW5jaXBhbChzZW5kZXIpO1xuICAgICAgZVtcInJlY2lwaWVudFwiXSA9IGV2ZW50LmZ0X3RyYW5zZmVyX2V2ZW50LnJlY2lwaWVudC5leHBlY3RQcmluY2lwYWwoXG4gICAgICAgIHJlY2lwaWVudCxcbiAgICAgICk7XG4gICAgICBpZiAoZXZlbnQuZnRfdHJhbnNmZXJfZXZlbnQuYXNzZXRfaWRlbnRpZmllci5lbmRzV2l0aChhc3NldElkKSkge1xuICAgICAgICBlW1wiYXNzZXRJZFwiXSA9IGV2ZW50LmZ0X3RyYW5zZmVyX2V2ZW50LmFzc2V0X2lkZW50aWZpZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgRnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQoJHthbW91bnR9LCAke3NlbmRlcn0sICR7cmVjaXBpZW50fSwgJHthc3NldElkfSlcXG4ke1xuICAgICAgSlNPTi5zdHJpbmdpZnkodGhpcylcbiAgICB9YCxcbiAgKTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3RGdW5naWJsZVRva2VuTWludEV2ZW50ID0gZnVuY3Rpb24gKFxuICBhbW91bnQ6IE51bWJlciB8IGJpZ2ludCxcbiAgcmVjaXBpZW50OiBTdHJpbmcsXG4gIGFzc2V0SWQ6IFN0cmluZyxcbikge1xuICBmb3IgKGxldCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBlOiBhbnkgPSB7fTtcbiAgICAgIGVbXCJhbW91bnRcIl0gPSBldmVudC5mdF9taW50X2V2ZW50LmFtb3VudC5leHBlY3RJbnQoYW1vdW50KTtcbiAgICAgIGVbXCJyZWNpcGllbnRcIl0gPSBldmVudC5mdF9taW50X2V2ZW50LnJlY2lwaWVudC5leHBlY3RQcmluY2lwYWwocmVjaXBpZW50KTtcbiAgICAgIGlmIChldmVudC5mdF9taW50X2V2ZW50LmFzc2V0X2lkZW50aWZpZXIuZW5kc1dpdGgoYXNzZXRJZCkpIHtcbiAgICAgICAgZVtcImFzc2V0SWRcIl0gPSBldmVudC5mdF9taW50X2V2ZW50LmFzc2V0X2lkZW50aWZpZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgRnVuZ2libGVUb2tlbk1pbnRFdmVudGApO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdEZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQgPSBmdW5jdGlvbiAoXG4gIGFtb3VudDogTnVtYmVyIHwgYmlnaW50LFxuICBzZW5kZXI6IFN0cmluZyxcbiAgYXNzZXRJZDogU3RyaW5nLFxuKSB7XG4gIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IGU6IGFueSA9IHt9O1xuICAgICAgZVtcImFtb3VudFwiXSA9IGV2ZW50LmZ0X2J1cm5fZXZlbnQuYW1vdW50LmV4cGVjdEludChhbW91bnQpO1xuICAgICAgZVtcInNlbmRlclwiXSA9IGV2ZW50LmZ0X2J1cm5fZXZlbnQuc2VuZGVyLmV4cGVjdFByaW5jaXBhbChzZW5kZXIpO1xuICAgICAgaWYgKGV2ZW50LmZ0X2J1cm5fZXZlbnQuYXNzZXRfaWRlbnRpZmllci5lbmRzV2l0aChhc3NldElkKSkge1xuICAgICAgICBlW1wiYXNzZXRJZFwiXSA9IGV2ZW50LmZ0X2J1cm5fZXZlbnQuYXNzZXRfaWRlbnRpZmllcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBGdW5naWJsZVRva2VuQnVybkV2ZW50YCk7XG59O1xuXG5BcnJheS5wcm90b3R5cGUuZXhwZWN0UHJpbnRFdmVudCA9IGZ1bmN0aW9uIChcbiAgY29udHJhY3RfaWRlbnRpZmllcjogc3RyaW5nLFxuICB2YWx1ZTogc3RyaW5nLFxuKSB7XG4gIGZvciAobGV0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IGU6IGFueSA9IHt9O1xuICAgICAgZVtcImNvbnRyYWN0X2lkZW50aWZpZXJcIl0gPSBldmVudC5jb250cmFjdF9ldmVudC5jb250cmFjdF9pZGVudGlmaWVyXG4gICAgICAgIC5leHBlY3RQcmluY2lwYWwoXG4gICAgICAgICAgY29udHJhY3RfaWRlbnRpZmllcixcbiAgICAgICAgKTtcblxuICAgICAgaWYgKGV2ZW50LmNvbnRyYWN0X2V2ZW50LnRvcGljLmVuZHNXaXRoKFwicHJpbnRcIikpIHtcbiAgICAgICAgZVtcInRvcGljXCJdID0gZXZlbnQuY29udHJhY3RfZXZlbnQudG9waWM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGV2ZW50LmNvbnRyYWN0X2V2ZW50LnZhbHVlLmVuZHNXaXRoKHZhbHVlKSkge1xuICAgICAgICBlW1widmFsdWVcIl0gPSBldmVudC5jb250cmFjdF9ldmVudC52YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBQcmludEV2ZW50YCk7XG59O1xuLy8gQXJyYXkucHJvdG90eXBlLmV4cGVjdEV2ZW50ID0gZnVuY3Rpb24oc2VsOiAoZTogT2JqZWN0KSA9PiBPYmplY3QpIHtcbi8vICAgICBmb3IgKGxldCBldmVudCBvZiB0aGlzKSB7XG4vLyAgICAgICAgIHRyeSB7XG4vLyAgICAgICAgICAgICBzZWwoZXZlbnQpO1xuLy8gICAgICAgICAgICAgcmV0dXJuIGV2ZW50IGFzIE9iamVjdDtcbi8vICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbi8vICAgICAgICAgICAgIGNvbnRpbnVlO1xuLy8gICAgICAgICB9XG4vLyAgICAgfVxuLy8gICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIFByaW50RXZlbnRgKTtcbi8vIH1cbkFycmF5LnByb3RvdHlwZS5leHBlY3ROb25GdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudCA9IGZ1bmN0aW9uIChcbiAgdG9rZW5JZDogU3RyaW5nLFxuICBzZW5kZXI6IFN0cmluZyxcbiAgcmVjaXBpZW50OiBTdHJpbmcsXG4gIGFzc2V0QWRkcmVzczogU3RyaW5nLFxuICBhc3NldElkOiBTdHJpbmcsXG4pIHtcbiAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgIHRyeSB7XG4gICAgICBsZXQgZTogYW55ID0ge307XG4gICAgICBpZiAoZXZlbnQubmZ0X3RyYW5zZmVyX2V2ZW50LnZhbHVlID09PSB0b2tlbklkKSB7XG4gICAgICAgIGVbXCJ0b2tlbklkXCJdID0gZXZlbnQubmZ0X3RyYW5zZmVyX2V2ZW50LnZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBlW1wic2VuZGVyXCJdID0gZXZlbnQubmZ0X3RyYW5zZmVyX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKTtcbiAgICAgIGVbXCJyZWNpcGllbnRcIl0gPSBldmVudC5uZnRfdHJhbnNmZXJfZXZlbnQucmVjaXBpZW50LmV4cGVjdFByaW5jaXBhbChcbiAgICAgICAgcmVjaXBpZW50LFxuICAgICAgKTtcbiAgICAgIGlmIChcbiAgICAgICAgZXZlbnQubmZ0X3RyYW5zZmVyX2V2ZW50LmFzc2V0X2lkZW50aWZpZXIgPT09XG4gICAgICAgICAgYCR7YXNzZXRBZGRyZXNzfTo6JHthc3NldElkfWBcbiAgICAgICkge1xuICAgICAgICBlW1wiYXNzZXRJZFwiXSA9IGV2ZW50Lm5mdF90cmFuc2Zlcl9ldmVudC5hc3NldF9pZGVudGlmaWVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIE5vbkZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50YCk7XG59O1xuXG5BcnJheS5wcm90b3R5cGUuZXhwZWN0Tm9uRnVuZ2libGVUb2tlbk1pbnRFdmVudCA9IGZ1bmN0aW9uIChcbiAgdG9rZW5JZDogU3RyaW5nLFxuICByZWNpcGllbnQ6IFN0cmluZyxcbiAgYXNzZXRBZGRyZXNzOiBTdHJpbmcsXG4gIGFzc2V0SWQ6IFN0cmluZyxcbikge1xuICBmb3IgKGxldCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBlOiBhbnkgPSB7fTtcbiAgICAgIGlmIChldmVudC5uZnRfbWludF9ldmVudC52YWx1ZSA9PT0gdG9rZW5JZCkge1xuICAgICAgICBlW1widG9rZW5JZFwiXSA9IGV2ZW50Lm5mdF9taW50X2V2ZW50LnZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBlW1wicmVjaXBpZW50XCJdID0gZXZlbnQubmZ0X21pbnRfZXZlbnQucmVjaXBpZW50LmV4cGVjdFByaW5jaXBhbChcbiAgICAgICAgcmVjaXBpZW50LFxuICAgICAgKTtcbiAgICAgIGlmIChcbiAgICAgICAgZXZlbnQubmZ0X21pbnRfZXZlbnQuYXNzZXRfaWRlbnRpZmllciA9PT0gYCR7YXNzZXRBZGRyZXNzfTo6JHthc3NldElkfWBcbiAgICAgICkge1xuICAgICAgICBlW1wiYXNzZXRJZFwiXSA9IGV2ZW50Lm5mdF9taW50X2V2ZW50LmFzc2V0X2lkZW50aWZpZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgTm9uRnVuZ2libGVUb2tlbk1pbnRFdmVudGApO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQgPSBmdW5jdGlvbiAoXG4gIHRva2VuSWQ6IFN0cmluZyxcbiAgc2VuZGVyOiBTdHJpbmcsXG4gIGFzc2V0QWRkcmVzczogU3RyaW5nLFxuICBhc3NldElkOiBTdHJpbmcsXG4pIHtcbiAgZm9yIChsZXQgZXZlbnQgb2YgdGhpcykge1xuICAgIHRyeSB7XG4gICAgICBsZXQgZTogYW55ID0ge307XG4gICAgICBpZiAoZXZlbnQubmZ0X2J1cm5fZXZlbnQudmFsdWUgPT09IHRva2VuSWQpIHtcbiAgICAgICAgZVtcInRva2VuSWRcIl0gPSBldmVudC5uZnRfYnVybl9ldmVudC52YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgZVtcInNlbmRlclwiXSA9IGV2ZW50Lm5mdF9idXJuX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKTtcbiAgICAgIGlmIChcbiAgICAgICAgZXZlbnQubmZ0X2J1cm5fZXZlbnQuYXNzZXRfaWRlbnRpZmllciA9PT0gYCR7YXNzZXRBZGRyZXNzfTo6JHthc3NldElkfWBcbiAgICAgICkge1xuICAgICAgICBlW1wiYXNzZXRJZFwiXSA9IGV2ZW50Lm5mdF9idXJuX2V2ZW50LmFzc2V0X2lkZW50aWZpZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgTm9uRnVuZ2libGVUb2tlbkJ1cm5FdmVudGApO1xufTtcblxuY29uc3Qgbm9Db2xvciA9IGdsb2JhbFRoaXMuRGVubz8ubm9Db2xvciA/PyB0cnVlO1xuXG5pbnRlcmZhY2UgQ29kZSB7XG4gIG9wZW46IHN0cmluZztcbiAgY2xvc2U6IHN0cmluZztcbiAgcmVnZXhwOiBSZWdFeHA7XG59XG5cbmxldCBlbmFibGVkID0gIW5vQ29sb3I7XG5cbmZ1bmN0aW9uIGNvZGUob3BlbjogbnVtYmVyW10sIGNsb3NlOiBudW1iZXIpOiBDb2RlIHtcbiAgcmV0dXJuIHtcbiAgICBvcGVuOiBgXFx4MWJbJHtvcGVuLmpvaW4oXCI7XCIpfW1gLFxuICAgIGNsb3NlOiBgXFx4MWJbJHtjbG9zZX1tYCxcbiAgICByZWdleHA6IG5ldyBSZWdFeHAoYFxcXFx4MWJcXFxcWyR7Y2xvc2V9bWAsIFwiZ1wiKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcnVuKHN0cjogc3RyaW5nLCBjb2RlOiBDb2RlKTogc3RyaW5nIHtcbiAgcmV0dXJuIGVuYWJsZWRcbiAgICA/IGAke2NvZGUub3Blbn0ke3N0ci5yZXBsYWNlKGNvZGUucmVnZXhwLCBjb2RlLm9wZW4pfSR7Y29kZS5jbG9zZX1gXG4gICAgOiBzdHI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWQoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcnVuKHN0ciwgY29kZShbMzFdLCAzOSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ3JlZW4oc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcnVuKHN0ciwgY29kZShbMzJdLCAzOSkpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sTUFBTSxFQUFFO0lBQ2IsSUFBSSxDQUFTO0lBQ2IsTUFBTSxDQUFTO0lBQ2YsWUFBWSxDQUFrQjtJQUM5QixXQUFXLENBQWM7SUFDekIsY0FBYyxDQUFvQjtJQUVsQyxZQUFZLElBQVksRUFBRSxNQUFjLENBQUU7UUFDeEMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7S0FDdEI7SUFFRCxPQUFPLFdBQVcsQ0FBQyxNQUFjLEVBQUUsU0FBaUIsRUFBRSxNQUFjLEVBQUU7UUFDcEUsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxBQUFDO1FBQzNCLEVBQUUsQ0FBQyxXQUFXLEdBQUc7WUFDZixTQUFTO1lBQ1QsTUFBTTtTQUNQLENBQUM7UUFDRixPQUFPLEVBQUUsQ0FBQztLQUNYO0lBRUQsT0FBTyxZQUFZLENBQ2pCLFFBQWdCLEVBQ2hCLE1BQWMsRUFDZCxJQUFtQixFQUNuQixNQUFjLEVBQ2Q7UUFDQSxJQUFJLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEFBQUM7UUFDM0IsRUFBRSxDQUFDLFlBQVksR0FBRztZ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