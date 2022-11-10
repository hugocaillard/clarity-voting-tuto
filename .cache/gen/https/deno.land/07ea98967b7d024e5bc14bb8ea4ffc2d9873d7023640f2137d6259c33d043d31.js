export * from "./types.ts";
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
        const tx = new Tx(1, sender);
        tx.transferStx = {
            recipient,
            amount
        };
        return tx;
    }
    static contractCall(contract, method, args, sender) {
        const tx = new Tx(2, sender);
        tx.contractCall = {
            contract,
            method,
            args
        };
        return tx;
    }
    static deployContract(name, code, sender) {
        const tx = new Tx(3, sender);
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
        const result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/mine_block", {
            sessionId: this.sessionId,
            transactions: transactions
        }));
        this.blockHeight = result.block_height;
        const block = {
            height: result.block_height,
            receipts: result.receipts
        };
        return block;
    }
    mineEmptyBlock(count) {
        const result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/mine_empty_blocks", {
            sessionId: this.sessionId,
            count: count
        }));
        this.blockHeight = result.block_height;
        const emptyBlock = {
            session_id: result.session_id,
            block_height: result.block_height
        };
        return emptyBlock;
    }
    mineEmptyBlockUntil(targetBlockHeight) {
        const count = targetBlockHeight - this.blockHeight;
        if (count < 0) {
            throw new Error(`Chain tip cannot be moved from ${this.blockHeight} to ${targetBlockHeight}`);
        }
        return this.mineEmptyBlock(count);
    }
    callReadOnlyFn(contract, method, args, sender) {
        const result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/call_read_only_fn", {
            sessionId: this.sessionId,
            contract: contract,
            method: method,
            args: args,
            sender: sender
        }));
        const readOnlyFn = {
            session_id: result.session_id,
            result: result.result,
            events: result.events
        };
        return readOnlyFn;
    }
    getAssetsMaps() {
        const result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/get_assets_maps", {
            sessionId: this.sessionId
        }));
        const assetsMaps = {
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
                const hasPreDeploymentSteps = options.preDeployment !== undefined;
                let result = JSON.parse(// @ts-ignore
                Deno.core.opSync("api/v1/new_session", {
                    name: options.name,
                    loadDeployment: !hasPreDeploymentSteps,
                    deploymentPath: options.deploymentPath
                }));
                if (options.preDeployment) {
                    const chain = new Chain(result.session_id);
                    const accounts = new Map();
                    for (const account of result.accounts){
                        accounts.set(account.name, account);
                    }
                    await options.preDeployment(chain, accounts);
                    result = JSON.parse(// @ts-ignore
                    Deno.core.opSync("api/v1/load_deployment", {
                        sessionId: chain.sessionId,
                        deploymentPath: options.deploymentPath
                    }));
                }
                const chain1 = new Chain(result.session_id);
                const accounts1 = new Map();
                for (const account1 of result.accounts){
                    accounts1.set(account1.name, account1);
                }
                const contracts = new Map();
                for (const contract of result.contracts){
                    contracts.set(contract.contract_id, contract);
                }
                await options.fn(chain1, accounts1, contracts);
                JSON.parse(// @ts-ignore
                Deno.core.opSync("api/v1/terminate_session", {
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
                const result = JSON.parse(// @ts-ignore
                Deno.core.opSync("api/v1/new_session", {
                    name: "running script",
                    loadDeployment: true,
                    deploymentPath: undefined
                }));
                const accounts = new Map();
                for (const account of result.accounts){
                    accounts.set(account.name, account);
                }
                const contracts = new Map();
                for (const contract of result.contracts){
                    contracts.set(contract.contract_id, contract);
                }
                const stacks_node = {
                    url: result.stacks_node_url
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
        const items = [];
        for (const [key, value] of Object.entries(input)){
            if (Array.isArray(value)) {
                throw new Error("Tuple value can't be an array");
            } else if (!!value && typeof value === "object") {
                items.push(`${key}: { ${serializeTuple(value)} }`);
            } else {
                items.push(`${key}: ${value}`);
            }
        }
        return items.join(", ");
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
// deno-lint-ignore ban-types
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
    const res = dst.slice(0, expectation.length);
    if (res !== expectation) {
        throw new Error(`Expected ${green(expectation.toString())}, got ${red(src.toString())}`);
    }
    let leftPad = 0;
    if (dst.charAt(expectation.length) === " ") {
        leftPad = 1;
    }
    const remainder = dst.substring(expectation.length + leftPad);
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
    const buffer = types.buff(value);
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
    const stack = [];
    const elements = [];
    let start = 1;
    for(let i = 0; i < this.length; i++){
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
    const remainder = this.substring(start, this.length - 1);
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
    const stack = [];
    const elements = [];
    for(let i = 0; i < this.length; i++){
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
    const remainder = this.substring(start, this.length - 1);
    if (remainder.length > 0) {
        elements.push(remainder);
    }
    const tuple = {};
    for (const element of elements){
        for(let i1 = 0; i1 < element.length; i1++){
            if (element.charAt(i1) === ":") {
                const key = element.substring(0, i1).trim();
                const value = element.substring(i1 + 2).trim();
                tuple[key] = value;
                break;
            }
        }
    }
    return tuple;
};
Array.prototype.expectSTXTransferEvent = function(amount, sender, recipient) {
    for (const { stx_transfer_event  } of this){
        try {
            return {
                amount: stx_transfer_event.amount.expectInt(amount),
                sender: stx_transfer_event.sender.expectPrincipal(sender),
                recipient: stx_transfer_event.recipient.expectPrincipal(recipient)
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected STXTransferEvent");
};
Array.prototype.expectFungibleTokenTransferEvent = function(amount, sender, recipient, assetId) {
    for (const { ft_transfer_event  } of this){
        try {
            if (!ft_transfer_event.asset_identifier.endsWith(assetId)) continue;
            return {
                amount: ft_transfer_event.amount.expectInt(amount),
                sender: ft_transfer_event.sender.expectPrincipal(sender),
                recipient: ft_transfer_event.recipient.expectPrincipal(recipient),
                assetId: ft_transfer_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected FungibleTokenTransferEvent(${amount}, ${sender}, ${recipient}, ${assetId})\n${JSON.stringify(this)}`);
};
Array.prototype.expectFungibleTokenMintEvent = function(amount, recipient, assetId) {
    for (const { ft_mint_event  } of this){
        try {
            if (!ft_mint_event.asset_identifier.endsWith(assetId)) continue;
            return {
                amount: ft_mint_event.amount.expectInt(amount),
                recipient: ft_mint_event.recipient.expectPrincipal(recipient),
                assetId: ft_mint_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected FungibleTokenMintEvent");
};
Array.prototype.expectFungibleTokenBurnEvent = function(amount, sender, assetId) {
    for (const { ft_burn_event  } of this){
        try {
            if (!ft_burn_event.asset_identifier.endsWith(assetId)) continue;
            return {
                amount: ft_burn_event.amount.expectInt(amount),
                sender: ft_burn_event.sender.expectPrincipal(sender),
                assetId: ft_burn_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected FungibleTokenBurnEvent");
};
Array.prototype.expectPrintEvent = function(contractIdentifier, value) {
    for (const { contract_event  } of this){
        try {
            if (!contract_event.topic.endsWith("print")) continue;
            if (!contract_event.value.endsWith(value)) continue;
            return {
                contract_identifier: contract_event.contract_identifier.expectPrincipal(contractIdentifier),
                topic: contract_event.topic,
                value: contract_event.value
            };
        } catch (error) {
            console.warn(error);
            continue;
        }
    }
    throw new Error("Unable to retrieve expected PrintEvent");
};
Array.prototype.expectNonFungibleTokenTransferEvent = function(tokenId, sender, recipient, assetAddress, assetId) {
    for (const { nft_transfer_event  } of this){
        try {
            if (nft_transfer_event.value !== tokenId) continue;
            if (nft_transfer_event.asset_identifier !== `${assetAddress}::${assetId}`) continue;
            return {
                tokenId: nft_transfer_event.value,
                sender: nft_transfer_event.sender.expectPrincipal(sender),
                recipient: nft_transfer_event.recipient.expectPrincipal(recipient),
                assetId: nft_transfer_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected NonFungibleTokenTransferEvent");
};
Array.prototype.expectNonFungibleTokenMintEvent = function(tokenId, recipient, assetAddress, assetId) {
    for (const { nft_mint_event  } of this){
        try {
            if (nft_mint_event.value !== tokenId) continue;
            if (nft_mint_event.asset_identifier !== `${assetAddress}::${assetId}`) continue;
            return {
                tokenId: nft_mint_event.value,
                recipient: nft_mint_event.recipient.expectPrincipal(recipient),
                assetId: nft_mint_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected NonFungibleTokenMintEvent");
};
Array.prototype.expectNonFungibleTokenBurnEvent = function(tokenId, sender, assetAddress, assetId) {
    for (const event of this){
        try {
            if (event.nft_burn_event.value !== tokenId) continue;
            if (event.nft_burn_event.asset_identifier !== `${assetAddress}::${assetId}`) continue;
            return {
                assetId: event.nft_burn_event.asset_identifier,
                tokenId: event.nft_burn_event.value,
                sender: event.nft_burn_event.sender.expectPrincipal(sender)
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected NonFungibleTokenBurnEvent");
};
const noColor = Deno.noColor ?? true;
const enabled = !noColor;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvY2xhcmluZXRAdjEuMC41L2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGRlbm8tbGludC1pZ25vcmUtZmlsZSBiYW4tdHMtY29tbWVudCBuby1uYW1lc3BhY2VcblxuaW1wb3J0IHtcbiAgRXhwZWN0RnVuZ2libGVUb2tlbkJ1cm5FdmVudCxcbiAgRXhwZWN0RnVuZ2libGVUb2tlbk1pbnRFdmVudCxcbiAgRXhwZWN0RnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQsXG4gIEV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQsXG4gIEV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5NaW50RXZlbnQsXG4gIEV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50LFxuICBFeHBlY3RQcmludEV2ZW50LFxuICBFeHBlY3RTVFhUcmFuc2ZlckV2ZW50LFxufSBmcm9tIFwiLi90eXBlcy50c1wiO1xuXG5leHBvcnQgKiBmcm9tIFwiLi90eXBlcy50c1wiO1xuXG5leHBvcnQgY2xhc3MgVHgge1xuICB0eXBlOiBudW1iZXI7XG4gIHNlbmRlcjogc3RyaW5nO1xuICBjb250cmFjdENhbGw/OiBUeENvbnRyYWN0Q2FsbDtcbiAgdHJhbnNmZXJTdHg/OiBUeFRyYW5zZmVyO1xuICBkZXBsb3lDb250cmFjdD86IFR4RGVwbG95Q29udHJhY3Q7XG5cbiAgY29uc3RydWN0b3IodHlwZTogbnVtYmVyLCBzZW5kZXI6IHN0cmluZykge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5zZW5kZXIgPSBzZW5kZXI7XG4gIH1cblxuICBzdGF0aWMgdHJhbnNmZXJTVFgoYW1vdW50OiBudW1iZXIsIHJlY2lwaWVudDogc3RyaW5nLCBzZW5kZXI6IHN0cmluZykge1xuICAgIGNvbnN0IHR4ID0gbmV3IFR4KDEsIHNlbmRlcik7XG4gICAgdHgudHJhbnNmZXJTdHggPSB7XG4gICAgICByZWNpcGllbnQsXG4gICAgICBhbW91bnQsXG4gICAgfTtcbiAgICByZXR1cm4gdHg7XG4gIH1cblxuICBzdGF0aWMgY29udHJhY3RDYWxsKFxuICAgIGNvbnRyYWN0OiBzdHJpbmcsXG4gICAgbWV0aG9kOiBzdHJpbmcsXG4gICAgYXJnczogQXJyYXk8c3RyaW5nPixcbiAgICBzZW5kZXI6IHN0cmluZ1xuICApIHtcbiAgICBjb25zdCB0eCA9IG5ldyBUeCgyLCBzZW5kZXIpO1xuICAgIHR4LmNvbnRyYWN0Q2FsbCA9IHtcbiAgICAgIGNvbnRyYWN0LFxuICAgICAgbWV0aG9kLFxuICAgICAgYXJncyxcbiAgICB9O1xuICAgIHJldHVybiB0eDtcbiAgfVxuXG4gIHN0YXRpYyBkZXBsb3lDb250cmFjdChuYW1lOiBzdHJpbmcsIGNvZGU6IHN0cmluZywgc2VuZGVyOiBzdHJpbmcpIHtcbiAgICBjb25zdCB0eCA9IG5ldyBUeCgzLCBzZW5kZXIpO1xuICAgIHR4LmRlcGxveUNvbnRyYWN0ID0ge1xuICAgICAgbmFtZSxcbiAgICAgIGNvZGUsXG4gICAgfTtcbiAgICByZXR1cm4gdHg7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeENvbnRyYWN0Q2FsbCB7XG4gIGNvbnRyYWN0OiBzdHJpbmc7XG4gIG1ldGhvZDogc3RyaW5nO1xuICBhcmdzOiBBcnJheTxzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFR4RGVwbG95Q29udHJhY3Qge1xuICBjb2RlOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeFRyYW5zZmVyIHtcbiAgYW1vdW50OiBudW1iZXI7XG4gIHJlY2lwaWVudDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFR4UmVjZWlwdCB7XG4gIHJlc3VsdDogc3RyaW5nO1xuICBldmVudHM6IEFycmF5PHVua25vd24+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJsb2NrIHtcbiAgaGVpZ2h0OiBudW1iZXI7XG4gIHJlY2VpcHRzOiBBcnJheTxUeFJlY2VpcHQ+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFjY291bnQge1xuICBhZGRyZXNzOiBzdHJpbmc7XG4gIGJhbGFuY2U6IG51bWJlcjtcbiAgbmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENoYWluIHtcbiAgc2Vzc2lvbklkOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZE9ubHlGbiB7XG4gIHNlc3Npb25faWQ6IG51bWJlcjtcbiAgcmVzdWx0OiBzdHJpbmc7XG4gIGV2ZW50czogQXJyYXk8dW5rbm93bj47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRW1wdHlCbG9jayB7XG4gIHNlc3Npb25faWQ6IG51bWJlcjtcbiAgYmxvY2tfaGVpZ2h0OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXNzZXRzTWFwcyB7XG4gIHNlc3Npb25faWQ6IG51bWJlcjtcbiAgYXNzZXRzOiB7XG4gICAgW25hbWU6IHN0cmluZ106IHtcbiAgICAgIFtvd25lcjogc3RyaW5nXTogbnVtYmVyO1xuICAgIH07XG4gIH07XG59XG5cbmV4cG9ydCBjbGFzcyBDaGFpbiB7XG4gIHNlc3Npb25JZDogbnVtYmVyO1xuICBibG9ja0hlaWdodCA9IDE7XG5cbiAgY29uc3RydWN0b3Ioc2Vzc2lvbklkOiBudW1iZXIpIHtcbiAgICB0aGlzLnNlc3Npb25JZCA9IHNlc3Npb25JZDtcbiAgfVxuXG4gIG1pbmVCbG9jayh0cmFuc2FjdGlvbnM6IEFycmF5PFR4Pik6IEJsb2NrIHtcbiAgICBjb25zdCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS9taW5lX2Jsb2NrXCIsIHtcbiAgICAgICAgc2Vzc2lvbklkOiB0aGlzLnNlc3Npb25JZCxcbiAgICAgICAgdHJhbnNhY3Rpb25zOiB0cmFuc2FjdGlvbnMsXG4gICAgICB9KVxuICAgICk7XG4gICAgdGhpcy5ibG9ja0hlaWdodCA9IHJlc3VsdC5ibG9ja19oZWlnaHQ7XG4gICAgY29uc3QgYmxvY2s6IEJsb2NrID0ge1xuICAgICAgaGVpZ2h0OiByZXN1bHQuYmxvY2tfaGVpZ2h0LFxuICAgICAgcmVjZWlwdHM6IHJlc3VsdC5yZWNlaXB0cyxcbiAgICB9O1xuICAgIHJldHVybiBibG9jaztcbiAgfVxuXG4gIG1pbmVFbXB0eUJsb2NrKGNvdW50OiBudW1iZXIpOiBFbXB0eUJsb2NrIHtcbiAgICBjb25zdCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS9taW5lX2VtcHR5X2Jsb2Nrc1wiLCB7XG4gICAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXG4gICAgICAgIGNvdW50OiBjb3VudCxcbiAgICAgIH0pXG4gICAgKTtcbiAgICB0aGlzLmJsb2NrSGVpZ2h0ID0gcmVzdWx0LmJsb2NrX2hlaWdodDtcbiAgICBjb25zdCBlbXB0eUJsb2NrOiBFbXB0eUJsb2NrID0ge1xuICAgICAgc2Vzc2lvbl9pZDogcmVzdWx0LnNlc3Npb25faWQsXG4gICAgICBibG9ja19oZWlnaHQ6IHJlc3VsdC5ibG9ja19oZWlnaHQsXG4gICAgfTtcbiAgICByZXR1cm4gZW1wdHlCbG9jaztcbiAgfVxuXG4gIG1pbmVFbXB0eUJsb2NrVW50aWwodGFyZ2V0QmxvY2tIZWlnaHQ6IG51bWJlcik6IEVtcHR5QmxvY2sge1xuICAgIGNvbnN0IGNvdW50ID0gdGFyZ2V0QmxvY2tIZWlnaHQgLSB0aGlzLmJsb2NrSGVpZ2h0O1xuICAgIGlmIChjb3VudCA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYENoYWluIHRpcCBjYW5ub3QgYmUgbW92ZWQgZnJvbSAke3RoaXMuYmxvY2tIZWlnaHR9IHRvICR7dGFyZ2V0QmxvY2tIZWlnaHR9YFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubWluZUVtcHR5QmxvY2soY291bnQpO1xuICB9XG5cbiAgY2FsbFJlYWRPbmx5Rm4oXG4gICAgY29udHJhY3Q6IHN0cmluZyxcbiAgICBtZXRob2Q6IHN0cmluZyxcbiAgICBhcmdzOiBBcnJheTx1bmtub3duPixcbiAgICBzZW5kZXI6IHN0cmluZ1xuICApOiBSZWFkT25seUZuIHtcbiAgICBjb25zdCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS9jYWxsX3JlYWRfb25seV9mblwiLCB7XG4gICAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXG4gICAgICAgIGNvbnRyYWN0OiBjb250cmFjdCxcbiAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgIGFyZ3M6IGFyZ3MsXG4gICAgICAgIHNlbmRlcjogc2VuZGVyLFxuICAgICAgfSlcbiAgICApO1xuICAgIGNvbnN0IHJlYWRPbmx5Rm46IFJlYWRPbmx5Rm4gPSB7XG4gICAgICBzZXNzaW9uX2lkOiByZXN1bHQuc2Vzc2lvbl9pZCxcbiAgICAgIHJlc3VsdDogcmVzdWx0LnJlc3VsdCxcbiAgICAgIGV2ZW50czogcmVzdWx0LmV2ZW50cyxcbiAgICB9O1xuICAgIHJldHVybiByZWFkT25seUZuO1xuICB9XG5cbiAgZ2V0QXNzZXRzTWFwcygpOiBBc3NldHNNYXBzIHtcbiAgICBjb25zdCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS9nZXRfYXNzZXRzX21hcHNcIiwge1xuICAgICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgICAgfSlcbiAgICApO1xuICAgIGNvbnN0IGFzc2V0c01hcHM6IEFzc2V0c01hcHMgPSB7XG4gICAgICBzZXNzaW9uX2lkOiByZXN1bHQuc2Vzc2lvbl9pZCxcbiAgICAgIGFzc2V0czogcmVzdWx0LmFzc2V0cyxcbiAgICB9O1xuICAgIHJldHVybiBhc3NldHNNYXBzO1xuICB9XG59XG5cbnR5cGUgUHJlRGVwbG95bWVudEZ1bmN0aW9uID0gKFxuICBjaGFpbjogQ2hhaW4sXG4gIGFjY291bnRzOiBNYXA8c3RyaW5nLCBBY2NvdW50PlxuKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcblxudHlwZSBUZXN0RnVuY3Rpb24gPSAoXG4gIGNoYWluOiBDaGFpbixcbiAgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+LFxuICBjb250cmFjdHM6IE1hcDxzdHJpbmcsIENvbnRyYWN0PlxuKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcblxuaW50ZXJmYWNlIFVuaXRUZXN0T3B0aW9ucyB7XG4gIG5hbWU6IHN0cmluZztcbiAgb25seT86IHRydWU7XG4gIGlnbm9yZT86IHRydWU7XG4gIGRlcGxveW1lbnRQYXRoPzogc3RyaW5nO1xuICBwcmVEZXBsb3ltZW50PzogUHJlRGVwbG95bWVudEZ1bmN0aW9uO1xuICBmbjogVGVzdEZ1bmN0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbnRyYWN0IHtcbiAgY29udHJhY3RfaWQ6IHN0cmluZztcbiAgc291cmNlOiBzdHJpbmc7XG4gIGNvbnRyYWN0X2ludGVyZmFjZTogdW5rbm93bjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdGFja3NOb2RlIHtcbiAgdXJsOiBzdHJpbmc7XG59XG5cbnR5cGUgU2NyaXB0RnVuY3Rpb24gPSAoXG4gIGFjY291bnRzOiBNYXA8c3RyaW5nLCBBY2NvdW50PixcbiAgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD4sXG4gIG5vZGU6IFN0YWNrc05vZGVcbikgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbmludGVyZmFjZSBTY3JpcHRPcHRpb25zIHtcbiAgZm46IFNjcmlwdEZ1bmN0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgQ2xhcmluZXQge1xuICBzdGF0aWMgdGVzdChvcHRpb25zOiBVbml0VGVzdE9wdGlvbnMpIHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgRGVuby50ZXN0KHtcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIG9ubHk6IG9wdGlvbnMub25seSxcbiAgICAgIGlnbm9yZTogb3B0aW9ucy5pZ25vcmUsXG4gICAgICBhc3luYyBmbigpIHtcbiAgICAgICAgY29uc3QgaGFzUHJlRGVwbG95bWVudFN0ZXBzID0gb3B0aW9ucy5wcmVEZXBsb3ltZW50ICE9PSB1bmRlZmluZWQ7XG5cbiAgICAgICAgbGV0IHJlc3VsdCA9IEpTT04ucGFyc2UoXG4gICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgIERlbm8uY29yZS5vcFN5bmMoXCJhcGkvdjEvbmV3X3Nlc3Npb25cIiwge1xuICAgICAgICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgICAgICAgbG9hZERlcGxveW1lbnQ6ICFoYXNQcmVEZXBsb3ltZW50U3RlcHMsXG4gICAgICAgICAgICBkZXBsb3ltZW50UGF0aDogb3B0aW9ucy5kZXBsb3ltZW50UGF0aCxcbiAgICAgICAgICB9KVxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnByZURlcGxveW1lbnQpIHtcbiAgICAgICAgICBjb25zdCBjaGFpbiA9IG5ldyBDaGFpbihyZXN1bHQuc2Vzc2lvbl9pZCk7XG4gICAgICAgICAgY29uc3QgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+ID0gbmV3IE1hcCgpO1xuICAgICAgICAgIGZvciAoY29uc3QgYWNjb3VudCBvZiByZXN1bHQuYWNjb3VudHMpIHtcbiAgICAgICAgICAgIGFjY291bnRzLnNldChhY2NvdW50Lm5hbWUsIGFjY291bnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhd2FpdCBvcHRpb25zLnByZURlcGxveW1lbnQoY2hhaW4sIGFjY291bnRzKTtcblxuICAgICAgICAgIHJlc3VsdCA9IEpTT04ucGFyc2UoXG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBEZW5vLmNvcmUub3BTeW5jKFwiYXBpL3YxL2xvYWRfZGVwbG95bWVudFwiLCB7XG4gICAgICAgICAgICAgIHNlc3Npb25JZDogY2hhaW4uc2Vzc2lvbklkLFxuICAgICAgICAgICAgICBkZXBsb3ltZW50UGF0aDogb3B0aW9ucy5kZXBsb3ltZW50UGF0aCxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNoYWluID0gbmV3IENoYWluKHJlc3VsdC5zZXNzaW9uX2lkKTtcbiAgICAgICAgY29uc3QgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+ID0gbmV3IE1hcCgpO1xuICAgICAgICBmb3IgKGNvbnN0IGFjY291bnQgb2YgcmVzdWx0LmFjY291bnRzKSB7XG4gICAgICAgICAgYWNjb3VudHMuc2V0KGFjY291bnQubmFtZSwgYWNjb3VudCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD4gPSBuZXcgTWFwKCk7XG4gICAgICAgIGZvciAoY29uc3QgY29udHJhY3Qgb2YgcmVzdWx0LmNvbnRyYWN0cykge1xuICAgICAgICAgIGNvbnRyYWN0cy5zZXQoY29udHJhY3QuY29udHJhY3RfaWQsIGNvbnRyYWN0KTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBvcHRpb25zLmZuKGNoYWluLCBhY2NvdW50cywgY29udHJhY3RzKTtcblxuICAgICAgICBKU09OLnBhcnNlKFxuICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICBEZW5vLmNvcmUub3BTeW5jKFwiYXBpL3YxL3Rlcm1pbmF0ZV9zZXNzaW9uXCIsIHtcbiAgICAgICAgICAgIHNlc3Npb25JZDogY2hhaW4uc2Vzc2lvbklkLFxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgc3RhdGljIHJ1bihvcHRpb25zOiBTY3JpcHRPcHRpb25zKSB7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIERlbm8udGVzdCh7XG4gICAgICBuYW1lOiBcInJ1bm5pbmcgc2NyaXB0XCIsXG4gICAgICBhc3luYyBmbigpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS9uZXdfc2Vzc2lvblwiLCB7XG4gICAgICAgICAgICBuYW1lOiBcInJ1bm5pbmcgc2NyaXB0XCIsXG4gICAgICAgICAgICBsb2FkRGVwbG95bWVudDogdHJ1ZSxcbiAgICAgICAgICAgIGRlcGxveW1lbnRQYXRoOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgYWNjb3VudHM6IE1hcDxzdHJpbmcsIEFjY291bnQ+ID0gbmV3IE1hcCgpO1xuICAgICAgICBmb3IgKGNvbnN0IGFjY291bnQgb2YgcmVzdWx0LmFjY291bnRzKSB7XG4gICAgICAgICAgYWNjb3VudHMuc2V0KGFjY291bnQubmFtZSwgYWNjb3VudCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD4gPSBuZXcgTWFwKCk7XG4gICAgICAgIGZvciAoY29uc3QgY29udHJhY3Qgb2YgcmVzdWx0LmNvbnRyYWN0cykge1xuICAgICAgICAgIGNvbnRyYWN0cy5zZXQoY29udHJhY3QuY29udHJhY3RfaWQsIGNvbnRyYWN0KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzdGFja3Nfbm9kZTogU3RhY2tzTm9kZSA9IHtcbiAgICAgICAgICB1cmw6IHJlc3VsdC5zdGFja3Nfbm9kZV91cmwsXG4gICAgICAgIH07XG4gICAgICAgIGF3YWl0IG9wdGlvbnMuZm4oYWNjb3VudHMsIGNvbnRyYWN0cywgc3RhY2tzX25vZGUpO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIHR5cGVzIHtcbiAgY29uc3QgYnl0ZVRvSGV4OiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGxldCBuID0gMDsgbiA8PSAweGZmOyArK24pIHtcbiAgICBjb25zdCBoZXhPY3RldCA9IG4udG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsIFwiMFwiKTtcbiAgICBieXRlVG9IZXgucHVzaChoZXhPY3RldCk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXJpYWxpemVUdXBsZShpbnB1dDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pIHtcbiAgICBjb25zdCBpdGVtczogQXJyYXk8c3RyaW5nPiA9IFtdO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGlucHV0KSkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlR1cGxlIHZhbHVlIGNhbid0IGJlIGFuIGFycmF5XCIpO1xuICAgICAgfSBlbHNlIGlmICghIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBpdGVtcy5wdXNoKFxuICAgICAgICAgIGAke2tleX06IHsgJHtzZXJpYWxpemVUdXBsZSh2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPil9IH1gXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpdGVtcy5wdXNoKGAke2tleX06ICR7dmFsdWV9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcy5qb2luKFwiLCBcIik7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gb2sodmFsOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gYChvayAke3ZhbH0pYDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBlcnIodmFsOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gYChlcnIgJHt2YWx9KWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gc29tZSh2YWw6IHN0cmluZykge1xuICAgIHJldHVybiBgKHNvbWUgJHt2YWx9KWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gbm9uZSgpIHtcbiAgICByZXR1cm4gYG5vbmVgO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIGJvb2wodmFsOiBib29sZWFuKSB7XG4gICAgcmV0dXJuIGAke3ZhbH1gO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIGludCh2YWw6IG51bWJlciB8IGJpZ2ludCkge1xuICAgIHJldHVybiBgJHt2YWx9YDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiB1aW50KHZhbDogbnVtYmVyIHwgYmlnaW50KSB7XG4gICAgcmV0dXJuIGB1JHt2YWx9YDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBhc2NpaSh2YWw6IHN0cmluZykge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWwpO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIHV0ZjgodmFsOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gYHUke0pTT04uc3RyaW5naWZ5KHZhbCl9YDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBidWZmKHZhbDogQXJyYXlCdWZmZXIgfCBzdHJpbmcpIHtcbiAgICBjb25zdCBidWZmID1cbiAgICAgIHR5cGVvZiB2YWwgPT0gXCJzdHJpbmdcIlxuICAgICAgICA/IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZSh2YWwpXG4gICAgICAgIDogbmV3IFVpbnQ4QXJyYXkodmFsKTtcblxuICAgIGNvbnN0IGhleE9jdGV0cyA9IG5ldyBBcnJheShidWZmLmxlbmd0aCk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmYubGVuZ3RoOyArK2kpIHtcbiAgICAgIGhleE9jdGV0c1tpXSA9IGJ5dGVUb0hleFtidWZmW2ldXTtcbiAgICB9XG5cbiAgICByZXR1cm4gYDB4JHtoZXhPY3RldHMuam9pbihcIlwiKX1gO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIGxpc3QodmFsOiBBcnJheTx1bmtub3duPikge1xuICAgIHJldHVybiBgKGxpc3QgJHt2YWwuam9pbihcIiBcIil9KWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gcHJpbmNpcGFsKHZhbDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAnJHt2YWx9YDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiB0dXBsZSh2YWw6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSB7XG4gICAgcmV0dXJuIGB7ICR7c2VyaWFsaXplVHVwbGUodmFsKX0gfWA7XG4gIH1cbn1cblxuZGVjbGFyZSBnbG9iYWwge1xuICBpbnRlcmZhY2UgU3RyaW5nIHtcbiAgICBleHBlY3RPaygpOiBzdHJpbmc7XG4gICAgZXhwZWN0RXJyKCk6IHN0cmluZztcbiAgICBleHBlY3RTb21lKCk6IHN0cmluZztcbiAgICBleHBlY3ROb25lKCk6IHZvaWQ7XG4gICAgZXhwZWN0Qm9vbCh2YWx1ZTogYm9vbGVhbik6IGJvb2xlYW47XG4gICAgZXhwZWN0VWludCh2YWx1ZTogbnVtYmVyIHwgYmlnaW50KTogYmlnaW50O1xuICAgIGV4cGVjdEludCh2YWx1ZTogbnVtYmVyIHwgYmlnaW50KTogYmlnaW50O1xuICAgIGV4cGVjdEJ1ZmYodmFsdWU6IEFycmF5QnVmZmVyKTogQXJyYXlCdWZmZXI7XG4gICAgZXhwZWN0QXNjaWkodmFsdWU6IHN0cmluZyk6IHN0cmluZztcbiAgICBleHBlY3RVdGY4KHZhbHVlOiBzdHJpbmcpOiBzdHJpbmc7XG4gICAgZXhwZWN0UHJpbmNpcGFsKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmc7XG4gICAgZXhwZWN0TGlzdCgpOiBBcnJheTxzdHJpbmc+O1xuICAgIGV4cGVjdFR1cGxlKCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIH1cblxuICBpbnRlcmZhY2UgQXJyYXk8VD4ge1xuICAgIGV4cGVjdFNUWFRyYW5zZmVyRXZlbnQoXG4gICAgICBhbW91bnQ6IG51bWJlciB8IGJpZ2ludCxcbiAgICAgIHNlbmRlcjogc3RyaW5nLFxuICAgICAgcmVjaXBpZW50OiBzdHJpbmdcbiAgICApOiBFeHBlY3RTVFhUcmFuc2ZlckV2ZW50O1xuICAgIGV4cGVjdEZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50KFxuICAgICAgYW1vdW50OiBudW1iZXIgfCBiaWdpbnQsXG4gICAgICBzZW5kZXI6IHN0cmluZyxcbiAgICAgIHJlY2lwaWVudDogc3RyaW5nLFxuICAgICAgYXNzZXRJZDogc3RyaW5nXG4gICAgKTogRXhwZWN0RnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQ7XG4gICAgZXhwZWN0RnVuZ2libGVUb2tlbk1pbnRFdmVudChcbiAgICAgIGFtb3VudDogbnVtYmVyIHwgYmlnaW50LFxuICAgICAgcmVjaXBpZW50OiBzdHJpbmcsXG4gICAgICBhc3NldElkOiBzdHJpbmdcbiAgICApOiBFeHBlY3RGdW5naWJsZVRva2VuTWludEV2ZW50O1xuICAgIGV4cGVjdEZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQoXG4gICAgICBhbW91bnQ6IG51bWJlciB8IGJpZ2ludCxcbiAgICAgIHNlbmRlcjogc3RyaW5nLFxuICAgICAgYXNzZXRJZDogc3RyaW5nXG4gICAgKTogRXhwZWN0RnVuZ2libGVUb2tlbkJ1cm5FdmVudDtcbiAgICBleHBlY3RQcmludEV2ZW50KFxuICAgICAgY29udHJhY3RJZGVudGlmaWVyOiBzdHJpbmcsXG4gICAgICB2YWx1ZTogc3RyaW5nXG4gICAgKTogRXhwZWN0UHJpbnRFdmVudDtcbiAgICBleHBlY3ROb25GdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudChcbiAgICAgIHRva2VuSWQ6IHN0cmluZyxcbiAgICAgIHNlbmRlcjogc3RyaW5nLFxuICAgICAgcmVjaXBpZW50OiBzdHJpbmcsXG4gICAgICBhc3NldEFkZHJlc3M6IHN0cmluZyxcbiAgICAgIGFzc2V0SWQ6IHN0cmluZ1xuICAgICk6IEV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50O1xuICAgIGV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5NaW50RXZlbnQoXG4gICAgICB0b2tlbklkOiBzdHJpbmcsXG4gICAgICByZWNpcGllbnQ6IHN0cmluZyxcbiAgICAgIGFzc2V0QWRkcmVzczogc3RyaW5nLFxuICAgICAgYXNzZXRJZDogc3RyaW5nXG4gICAgKTogRXhwZWN0Tm9uRnVuZ2libGVUb2tlbk1pbnRFdmVudDtcbiAgICBleHBlY3ROb25GdW5naWJsZVRva2VuQnVybkV2ZW50KFxuICAgICAgdG9rZW5JZDogc3RyaW5nLFxuICAgICAgc2VuZGVyOiBzdHJpbmcsXG4gICAgICBhc3NldEFkZHJlc3M6IHN0cmluZyxcbiAgICAgIGFzc2V0SWQ6IHN0cmluZ1xuICAgICk6IEV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQ7XG4gIH1cbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbmZ1bmN0aW9uIGNvbnN1bWUoc3JjOiBTdHJpbmcsIGV4cGVjdGF0aW9uOiBzdHJpbmcsIHdyYXBwZWQ6IGJvb2xlYW4pIHtcbiAgbGV0IGRzdCA9IChcIiBcIiArIHNyYykuc2xpY2UoMSk7XG4gIGxldCBzaXplID0gZXhwZWN0YXRpb24ubGVuZ3RoO1xuICBpZiAoIXdyYXBwZWQgJiYgc3JjICE9PSBleHBlY3RhdGlvbikge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBFeHBlY3RlZCAke2dyZWVuKGV4cGVjdGF0aW9uLnRvU3RyaW5nKCkpfSwgZ290ICR7cmVkKHNyYy50b1N0cmluZygpKX1gXG4gICAgKTtcbiAgfVxuICBpZiAod3JhcHBlZCkge1xuICAgIHNpemUgKz0gMjtcbiAgfVxuICBpZiAoZHN0Lmxlbmd0aCA8IHNpemUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgJHtncmVlbihleHBlY3RhdGlvbi50b1N0cmluZygpKX0sIGdvdCAke3JlZChzcmMudG9TdHJpbmcoKSl9YFxuICAgICk7XG4gIH1cbiAgaWYgKHdyYXBwZWQpIHtcbiAgICBkc3QgPSBkc3Quc3Vic3RyaW5nKDEsIGRzdC5sZW5ndGggLSAxKTtcbiAgfVxuICBjb25zdCByZXMgPSBkc3Quc2xpY2UoMCwgZXhwZWN0YXRpb24ubGVuZ3RoKTtcbiAgaWYgKHJlcyAhPT0gZXhwZWN0YXRpb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgJHtncmVlbihleHBlY3RhdGlvbi50b1N0cmluZygpKX0sIGdvdCAke3JlZChzcmMudG9TdHJpbmcoKSl9YFxuICAgICk7XG4gIH1cbiAgbGV0IGxlZnRQYWQgPSAwO1xuICBpZiAoZHN0LmNoYXJBdChleHBlY3RhdGlvbi5sZW5ndGgpID09PSBcIiBcIikge1xuICAgIGxlZnRQYWQgPSAxO1xuICB9XG4gIGNvbnN0IHJlbWFpbmRlciA9IGRzdC5zdWJzdHJpbmcoZXhwZWN0YXRpb24ubGVuZ3RoICsgbGVmdFBhZCk7XG4gIHJldHVybiByZW1haW5kZXI7XG59XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0T2sgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBjb25zdW1lKHRoaXMsIFwib2tcIiwgdHJ1ZSk7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdEVyciA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGNvbnN1bWUodGhpcywgXCJlcnJcIiwgdHJ1ZSk7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdFNvbWUgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBjb25zdW1lKHRoaXMsIFwic29tZVwiLCB0cnVlKTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0Tm9uZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGNvbnN1bWUodGhpcywgXCJub25lXCIsIGZhbHNlKTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0Qm9vbCA9IGZ1bmN0aW9uICh2YWx1ZTogYm9vbGVhbikge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYCR7dmFsdWV9YCwgZmFsc2UpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHRocm93IGVycm9yO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0VWludCA9IGZ1bmN0aW9uICh2YWx1ZTogbnVtYmVyIHwgYmlnaW50KTogYmlnaW50IHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGB1JHt2YWx1ZX1gLCBmYWxzZSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbiAgcmV0dXJuIEJpZ0ludCh2YWx1ZSk7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdEludCA9IGZ1bmN0aW9uICh2YWx1ZTogbnVtYmVyIHwgYmlnaW50KTogYmlnaW50IHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGAke3ZhbHVlfWAsIGZhbHNlKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuICByZXR1cm4gQmlnSW50KHZhbHVlKTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0QnVmZiA9IGZ1bmN0aW9uICh2YWx1ZTogQXJyYXlCdWZmZXIpIHtcbiAgY29uc3QgYnVmZmVyID0gdHlwZXMuYnVmZih2YWx1ZSk7XG4gIGlmICh0aGlzICE9PSBidWZmZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7Z3JlZW4oYnVmZmVyKX0sIGdvdCAke3JlZCh0aGlzLnRvU3RyaW5nKCkpfWApO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0QXNjaWkgPSBmdW5jdGlvbiAodmFsdWU6IHN0cmluZykge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYFwiJHt2YWx1ZX1cImAsIGZhbHNlKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdFV0ZjggPSBmdW5jdGlvbiAodmFsdWU6IHN0cmluZykge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYHVcIiR7dmFsdWV9XCJgLCBmYWxzZSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RQcmluY2lwYWwgPSBmdW5jdGlvbiAodmFsdWU6IHN0cmluZykge1xuICB0cnkge1xuICAgIGNvbnN1bWUodGhpcywgYCR7dmFsdWV9YCwgZmFsc2UpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHRocm93IGVycm9yO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0TGlzdCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuY2hhckF0KDApICE9PSBcIltcIiB8fCB0aGlzLmNoYXJBdCh0aGlzLmxlbmd0aCAtIDEpICE9PSBcIl1cIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBFeHBlY3RlZCAke2dyZWVuKFwiKGxpc3QgLi4uKVwiKX0sIGdvdCAke3JlZCh0aGlzLnRvU3RyaW5nKCkpfWBcbiAgICApO1xuICB9XG5cbiAgY29uc3Qgc3RhY2sgPSBbXTtcbiAgY29uc3QgZWxlbWVudHMgPSBbXTtcbiAgbGV0IHN0YXJ0ID0gMTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIixcIiAmJiBzdGFjay5sZW5ndGggPT0gMSkge1xuICAgICAgZWxlbWVudHMucHVzaCh0aGlzLnN1YnN0cmluZyhzdGFydCwgaSkpO1xuICAgICAgc3RhcnQgPSBpICsgMjtcbiAgICB9XG4gICAgaWYgKFtcIihcIiwgXCJbXCIsIFwie1wiXS5pbmNsdWRlcyh0aGlzLmNoYXJBdChpKSkpIHtcbiAgICAgIHN0YWNrLnB1c2godGhpcy5jaGFyQXQoaSkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwiKVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIihcIikge1xuICAgICAgc3RhY2sucG9wKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCJ9XCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwie1wiKSB7XG4gICAgICBzdGFjay5wb3AoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIl1cIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCJbXCIpIHtcbiAgICAgIHN0YWNrLnBvcCgpO1xuICAgIH1cbiAgfVxuICBjb25zdCByZW1haW5kZXIgPSB0aGlzLnN1YnN0cmluZyhzdGFydCwgdGhpcy5sZW5ndGggLSAxKTtcbiAgaWYgKHJlbWFpbmRlci5sZW5ndGggPiAwKSB7XG4gICAgZWxlbWVudHMucHVzaChyZW1haW5kZXIpO1xuICB9XG4gIHJldHVybiBlbGVtZW50cztcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0VHVwbGUgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmNoYXJBdCgwKSAhPT0gXCJ7XCIgfHwgdGhpcy5jaGFyQXQodGhpcy5sZW5ndGggLSAxKSAhPT0gXCJ9XCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgJHtncmVlbihcIih0dXBsZSAuLi4pXCIpfSwgZ290ICR7cmVkKHRoaXMudG9TdHJpbmcoKSl9YFxuICAgICk7XG4gIH1cblxuICBsZXQgc3RhcnQgPSAxO1xuICBjb25zdCBzdGFjayA9IFtdO1xuICBjb25zdCBlbGVtZW50cyA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwiLFwiICYmIHN0YWNrLmxlbmd0aCA9PSAxKSB7XG4gICAgICBlbGVtZW50cy5wdXNoKHRoaXMuc3Vic3RyaW5nKHN0YXJ0LCBpKSk7XG4gICAgICBzdGFydCA9IGkgKyAyO1xuICAgIH1cbiAgICBpZiAoW1wiKFwiLCBcIltcIiwgXCJ7XCJdLmluY2x1ZGVzKHRoaXMuY2hhckF0KGkpKSkge1xuICAgICAgc3RhY2sucHVzaCh0aGlzLmNoYXJBdChpKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCIpXCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwiKFwiKSB7XG4gICAgICBzdGFjay5wb3AoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIn1cIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCJ7XCIpIHtcbiAgICAgIHN0YWNrLnBvcCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwiXVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIltcIikge1xuICAgICAgc3RhY2sucG9wKCk7XG4gICAgfVxuICB9XG4gIGNvbnN0IHJlbWFpbmRlciA9IHRoaXMuc3Vic3RyaW5nKHN0YXJ0LCB0aGlzLmxlbmd0aCAtIDEpO1xuICBpZiAocmVtYWluZGVyLmxlbmd0aCA+IDApIHtcbiAgICBlbGVtZW50cy5wdXNoKHJlbWFpbmRlcik7XG4gIH1cblxuICBjb25zdCB0dXBsZTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVsZW1lbnQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChlbGVtZW50LmNoYXJBdChpKSA9PT0gXCI6XCIpIHtcbiAgICAgICAgY29uc3Qga2V5ID0gZWxlbWVudC5zdWJzdHJpbmcoMCwgaSkudHJpbSgpO1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGVsZW1lbnQuc3Vic3RyaW5nKGkgKyAyKS50cmltKCk7XG4gICAgICAgIHR1cGxlW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHR1cGxlO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdFNUWFRyYW5zZmVyRXZlbnQgPSBmdW5jdGlvbiAoYW1vdW50LCBzZW5kZXIsIHJlY2lwaWVudCkge1xuICBmb3IgKGNvbnN0IHsgc3R4X3RyYW5zZmVyX2V2ZW50IH0gb2YgdGhpcykge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBhbW91bnQ6IHN0eF90cmFuc2Zlcl9ldmVudC5hbW91bnQuZXhwZWN0SW50KGFtb3VudCksXG4gICAgICAgIHNlbmRlcjogc3R4X3RyYW5zZmVyX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKSxcbiAgICAgICAgcmVjaXBpZW50OiBzdHhfdHJhbnNmZXJfZXZlbnQucmVjaXBpZW50LmV4cGVjdFByaW5jaXBhbChyZWNpcGllbnQpLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgU1RYVHJhbnNmZXJFdmVudFwiKTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3RGdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudCA9IGZ1bmN0aW9uIChcbiAgYW1vdW50LFxuICBzZW5kZXIsXG4gIHJlY2lwaWVudCxcbiAgYXNzZXRJZFxuKSB7XG4gIGZvciAoY29uc3QgeyBmdF90cmFuc2Zlcl9ldmVudCB9IG9mIHRoaXMpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKCFmdF90cmFuc2Zlcl9ldmVudC5hc3NldF9pZGVudGlmaWVyLmVuZHNXaXRoKGFzc2V0SWQpKSBjb250aW51ZTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYW1vdW50OiBmdF90cmFuc2Zlcl9ldmVudC5hbW91bnQuZXhwZWN0SW50KGFtb3VudCksXG4gICAgICAgIHNlbmRlcjogZnRfdHJhbnNmZXJfZXZlbnQuc2VuZGVyLmV4cGVjdFByaW5jaXBhbChzZW5kZXIpLFxuICAgICAgICByZWNpcGllbnQ6IGZ0X3RyYW5zZmVyX2V2ZW50LnJlY2lwaWVudC5leHBlY3RQcmluY2lwYWwocmVjaXBpZW50KSxcbiAgICAgICAgYXNzZXRJZDogZnRfdHJhbnNmZXJfZXZlbnQuYXNzZXRfaWRlbnRpZmllcixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgRnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQoJHthbW91bnR9LCAke3NlbmRlcn0sICR7cmVjaXBpZW50fSwgJHthc3NldElkfSlcXG4ke0pTT04uc3RyaW5naWZ5KFxuICAgICAgdGhpc1xuICAgICl9YFxuICApO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdEZ1bmdpYmxlVG9rZW5NaW50RXZlbnQgPSBmdW5jdGlvbiAoXG4gIGFtb3VudCxcbiAgcmVjaXBpZW50LFxuICBhc3NldElkXG4pIHtcbiAgZm9yIChjb25zdCB7IGZ0X21pbnRfZXZlbnQgfSBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghZnRfbWludF9ldmVudC5hc3NldF9pZGVudGlmaWVyLmVuZHNXaXRoKGFzc2V0SWQpKSBjb250aW51ZTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYW1vdW50OiBmdF9taW50X2V2ZW50LmFtb3VudC5leHBlY3RJbnQoYW1vdW50KSxcbiAgICAgICAgcmVjaXBpZW50OiBmdF9taW50X2V2ZW50LnJlY2lwaWVudC5leHBlY3RQcmluY2lwYWwocmVjaXBpZW50KSxcbiAgICAgICAgYXNzZXRJZDogZnRfbWludF9ldmVudC5hc3NldF9pZGVudGlmaWVyLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgRnVuZ2libGVUb2tlbk1pbnRFdmVudFwiKTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3RGdW5naWJsZVRva2VuQnVybkV2ZW50ID0gZnVuY3Rpb24gKFxuICBhbW91bnQsXG4gIHNlbmRlcixcbiAgYXNzZXRJZFxuKSB7XG4gIGZvciAoY29uc3QgeyBmdF9idXJuX2V2ZW50IH0gb2YgdGhpcykge1xuICAgIHRyeSB7XG4gICAgICBpZiAoIWZ0X2J1cm5fZXZlbnQuYXNzZXRfaWRlbnRpZmllci5lbmRzV2l0aChhc3NldElkKSkgY29udGludWU7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFtb3VudDogZnRfYnVybl9ldmVudC5hbW91bnQuZXhwZWN0SW50KGFtb3VudCksXG4gICAgICAgIHNlbmRlcjogZnRfYnVybl9ldmVudC5zZW5kZXIuZXhwZWN0UHJpbmNpcGFsKHNlbmRlciksXG4gICAgICAgIGFzc2V0SWQ6IGZ0X2J1cm5fZXZlbnQuYXNzZXRfaWRlbnRpZmllcixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIEZ1bmdpYmxlVG9rZW5CdXJuRXZlbnRcIik7XG59O1xuXG5BcnJheS5wcm90b3R5cGUuZXhwZWN0UHJpbnRFdmVudCA9IGZ1bmN0aW9uIChjb250cmFjdElkZW50aWZpZXIsIHZhbHVlKSB7XG4gIGZvciAoY29uc3QgeyBjb250cmFjdF9ldmVudCB9IG9mIHRoaXMpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKCFjb250cmFjdF9ldmVudC50b3BpYy5lbmRzV2l0aChcInByaW50XCIpKSBjb250aW51ZTtcbiAgICAgIGlmICghY29udHJhY3RfZXZlbnQudmFsdWUuZW5kc1dpdGgodmFsdWUpKSBjb250aW51ZTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29udHJhY3RfaWRlbnRpZmllcjpcbiAgICAgICAgICBjb250cmFjdF9ldmVudC5jb250cmFjdF9pZGVudGlmaWVyLmV4cGVjdFByaW5jaXBhbChcbiAgICAgICAgICAgIGNvbnRyYWN0SWRlbnRpZmllclxuICAgICAgICAgICksXG4gICAgICAgIHRvcGljOiBjb250cmFjdF9ldmVudC50b3BpYyxcbiAgICAgICAgdmFsdWU6IGNvbnRyYWN0X2V2ZW50LnZhbHVlLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGVycm9yKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgUHJpbnRFdmVudFwiKTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3ROb25GdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudCA9IGZ1bmN0aW9uIChcbiAgdG9rZW5JZCxcbiAgc2VuZGVyLFxuICByZWNpcGllbnQsXG4gIGFzc2V0QWRkcmVzcyxcbiAgYXNzZXRJZFxuKSB7XG4gIGZvciAoY29uc3QgeyBuZnRfdHJhbnNmZXJfZXZlbnQgfSBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChuZnRfdHJhbnNmZXJfZXZlbnQudmFsdWUgIT09IHRva2VuSWQpIGNvbnRpbnVlO1xuICAgICAgaWYgKG5mdF90cmFuc2Zlcl9ldmVudC5hc3NldF9pZGVudGlmaWVyICE9PSBgJHthc3NldEFkZHJlc3N9Ojoke2Fzc2V0SWR9YClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRva2VuSWQ6IG5mdF90cmFuc2Zlcl9ldmVudC52YWx1ZSxcbiAgICAgICAgc2VuZGVyOiBuZnRfdHJhbnNmZXJfZXZlbnQuc2VuZGVyLmV4cGVjdFByaW5jaXBhbChzZW5kZXIpLFxuICAgICAgICByZWNpcGllbnQ6IG5mdF90cmFuc2Zlcl9ldmVudC5yZWNpcGllbnQuZXhwZWN0UHJpbmNpcGFsKHJlY2lwaWVudCksXG4gICAgICAgIGFzc2V0SWQ6IG5mdF90cmFuc2Zlcl9ldmVudC5hc3NldF9pZGVudGlmaWVyLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgTm9uRnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnRcIik7XG59O1xuXG5BcnJheS5wcm90b3R5cGUuZXhwZWN0Tm9uRnVuZ2libGVUb2tlbk1pbnRFdmVudCA9IGZ1bmN0aW9uIChcbiAgdG9rZW5JZCxcbiAgcmVjaXBpZW50LFxuICBhc3NldEFkZHJlc3MsXG4gIGFzc2V0SWRcbikge1xuICBmb3IgKGNvbnN0IHsgbmZ0X21pbnRfZXZlbnQgfSBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChuZnRfbWludF9ldmVudC52YWx1ZSAhPT0gdG9rZW5JZCkgY29udGludWU7XG4gICAgICBpZiAobmZ0X21pbnRfZXZlbnQuYXNzZXRfaWRlbnRpZmllciAhPT0gYCR7YXNzZXRBZGRyZXNzfTo6JHthc3NldElkfWApXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b2tlbklkOiBuZnRfbWludF9ldmVudC52YWx1ZSxcbiAgICAgICAgcmVjaXBpZW50OiBuZnRfbWludF9ldmVudC5yZWNpcGllbnQuZXhwZWN0UHJpbmNpcGFsKHJlY2lwaWVudCksXG4gICAgICAgIGFzc2V0SWQ6IG5mdF9taW50X2V2ZW50LmFzc2V0X2lkZW50aWZpZXIsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBOb25GdW5naWJsZVRva2VuTWludEV2ZW50XCIpO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQgPSBmdW5jdGlvbiAoXG4gIHRva2VuSWQsXG4gIHNlbmRlcixcbiAgYXNzZXRBZGRyZXNzLFxuICBhc3NldElkXG4pIHtcbiAgZm9yIChjb25zdCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChldmVudC5uZnRfYnVybl9ldmVudC52YWx1ZSAhPT0gdG9rZW5JZCkgY29udGludWU7XG4gICAgICBpZiAoXG4gICAgICAgIGV2ZW50Lm5mdF9idXJuX2V2ZW50LmFzc2V0X2lkZW50aWZpZXIgIT09IGAke2Fzc2V0QWRkcmVzc306OiR7YXNzZXRJZH1gXG4gICAgICApXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBhc3NldElkOiBldmVudC5uZnRfYnVybl9ldmVudC5hc3NldF9pZGVudGlmaWVyLFxuICAgICAgICB0b2tlbklkOiBldmVudC5uZnRfYnVybl9ldmVudC52YWx1ZSxcbiAgICAgICAgc2VuZGVyOiBldmVudC5uZnRfYnVybl9ldmVudC5zZW5kZXIuZXhwZWN0UHJpbmNpcGFsKHNlbmRlciksXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBOb25GdW5naWJsZVRva2VuQnVybkV2ZW50XCIpO1xufTtcblxuY29uc3Qgbm9Db2xvciA9IERlbm8ubm9Db2xvciA/PyB0cnVlO1xuY29uc3QgZW5hYmxlZCA9ICFub0NvbG9yO1xuXG5pbnRlcmZhY2UgQ29kZSB7XG4gIG9wZW46IHN0cmluZztcbiAgY2xvc2U6IHN0cmluZztcbiAgcmVnZXhwOiBSZWdFeHA7XG59XG5cbmZ1bmN0aW9uIGNvZGUob3BlbjogbnVtYmVyW10sIGNsb3NlOiBudW1iZXIpOiBDb2RlIHtcbiAgcmV0dXJuIHtcbiAgICBvcGVuOiBgXFx4MWJbJHtvcGVuLmpvaW4oXCI7XCIpfW1gLFxuICAgIGNsb3NlOiBgXFx4MWJbJHtjbG9zZX1tYCxcbiAgICByZWdleHA6IG5ldyBSZWdFeHAoYFxcXFx4MWJcXFxcWyR7Y2xvc2V9bWAsIFwiZ1wiKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcnVuKHN0cjogc3RyaW5nLCBjb2RlOiBDb2RlKTogc3RyaW5nIHtcbiAgcmV0dXJuIGVuYWJsZWRcbiAgICA/IGAke2NvZGUub3Blbn0ke3N0ci5yZXBsYWNlKGNvZGUucmVnZXhwLCBjb2RlLm9wZW4pfSR7Y29kZS5jbG9zZX1gXG4gICAgOiBzdHI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWQoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcnVuKHN0ciwgY29kZShbMzFdLCAzOSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ3JlZW4oc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcnVuKHN0ciwgY29kZShbMzJdLCAzOSkpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWFBLGNBQWMsWUFBWSxDQUFDO0FBRTNCLE9BQU8sTUFBTSxFQUFFO0lBQ2IsSUFBSSxDQUFTO0lBQ2IsTUFBTSxDQUFTO0lBQ2YsWUFBWSxDQUFrQjtJQUM5QixXQUFXLENBQWM7SUFDekIsY0FBYyxDQUFvQjtJQUVsQyxZQUFZLElBQVksRUFBRSxNQUFjLENBQUU7UUFDeEMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7S0FDdEI7SUFFRCxPQUFPLFdBQVcsQ0FBQyxNQUFjLEVBQUUsU0FBaUIsRUFBRSxNQUFjLEVBQUU7UUFDcEUsTUFBTSxFQUFFLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxBQUFDO1FBQzdCLEVBQUUsQ0FBQyxXQUFXLEdBQUc7WUFDZixTQUFTO1lBQ1QsTUFBTTtTQUNQLENBQUM7UUFDRixPQUFPLEVBQUUsQ0FBQztLQUNYO0lBRUQsT0FBTyxZQUFZLENBQ2pCLFFBQWdCLEVBQ2hCLE1BQWMsRUFDZCxJQUFtQixFQUNuQixNQUFjLEVBQ2Q7UUFDQSxNQUFNLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEFBQUM7UUFDN0IsRUFBRSxDQUFDLFlBQVksR0FBRztZQUNoQixRQUFRO1lBQ1IsTUFBTTtZQUNOLElBQUk7U0FDTCxDQUFDO1FBQ0YsT0FBTyxFQUFFLENBQUM7S0FDWDtJQUVELE9BQU8sY0FBYyxDQUFDLElBQVksRUFBRSxJQUFZLEVBQUUsTUFBYyxFQUFFO1FBQ2hFLE1BQU0sRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQUFBQztRQUM3QixFQUFFLENBQUMsY0FBYyxHQUFHO1lBQ2xCLElBQUk7WUFDSixJQUFJO1NBQ0wsQ0FBQztRQUNGLE9BQU8sRUFBRSxDQUFDO0tBQ1g7Q0FDRjtBQTBERCxPQUFPLE1BQU0sS0FBSztJQUNoQixTQUFTLENBQVM7SUFDbEIsV0FBVyxHQUFHLENBQUMsQ0FBQztJQUVoQixZQUFZLFNBQWlCLENBQUU7UUFDN0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7S0FDNUI7SUFFRCxTQUFTLENBQUMsWUFBdUIsRUFBUztRQUN4QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUN2QixhQUFhO1FBQ2IsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLEVBQUU7WUFDcEMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO1lBQ3pCLFlBQVksRUFBRSxZQUFZO1NBQzNCLENBQUMsQ0FDSCxBQUFDO1FBQ0YsSUFBSSxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDO1FBQ3ZDLE1BQU0sS0FBSyxHQUFVO1lBQ25CLE1BQU0sRUFBRSxNQUFNLENBQUMsWUFBWTtZQUMzQixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7U0FDMUIsQUFBQztRQUNGLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxjQUFjLENBQUMsS0FBYSxFQUFjO1FBQ3hDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQ3ZCLGFBQWE7UUFDYixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQywwQkFBMEIsRUFBRTtZQUMzQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDekIsS0FBSyxFQUFFLEtBQUs7U0FDYixDQUFDLENBQ0gsQUFBQztRQUNGLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUN2QyxNQUFNLFVBQVUsR0FBZTtZQUM3QixVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7WUFDN0IsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZO1NBQ2xDLEFBQUM7UUFDRixPQUFPLFVBQVUsQ0FBQztLQUNuQjtJQUVELG1CQUFtQixDQUFDLGlCQUF5QixFQUFjO1FBQ3pELE1BQU0sS0FBSyxHQUFHLGlCQUFpQixHQUFHLElBQUksQ0FBQyxXQUFXLEFBQUM7UUFDbkQsSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFO1lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FDYixDQUFDLCtCQUErQixFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLGlCQUFpQixDQUFDLENBQUMsQ0FDN0UsQ0FBQztTQUNIO1FBQ0QsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ25DO0lBRUQsY0FBYyxDQUNaLFFBQWdCLEVBQ2hCLE1BQWMsRUFDZCxJQUFvQixFQUNwQixNQUFjLEVBQ0Y7UUFDWixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUN2QixhQUFhO1FBQ2IsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsMEJBQTBCLEVBQUU7WUFDM0MsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO1lBQ3pCLFFBQVEsRUFBRSxRQUFRO1lBQ2xCLE1BQU0sRUFBRSxNQUFNO1lBQ2QsSUFBSSxFQUFFLElBQUk7WUFDVixNQUFNLEVBQUUsTUFBTTtTQUNmLENBQUMsQ0FDSCxBQUFDO1FBQ0YsTUFBTSxVQUFVLEdBQWU7WUFDN0IsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVO1lBQzdCLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtZQUNyQixNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07U0FDdEIsQUFBQztRQUNGLE9BQU8sVUFBVSxDQUFDO0tBQ25CO0lBRUQsYUFBYSxHQUFlO1FBQzFCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQ3ZCLGFBQWE7UUFDYixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyx3QkFBd0IsRUFBRTtZQUN6QyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7U0FDMUIsQ0FBQyxDQUNILEFBQUM7UUFDRixNQUFNLFVBQVUsR0FBZTtZQUM3QixVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7WUFDN0IsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1NBQ3RCLEFBQUM7UUFDRixPQUFPLFVBQVUsQ0FBQztLQUNuQjtDQUNGO0FBMENELE9BQU8sTUFBTSxRQUFRO0lBQ25CLE9BQU8sSUFBSSxDQUFDLE9BQXdCLEVBQUU7UUFDcEMsYUFBYTtRQUNiLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDUixJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7WUFDbEIsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJO1lBQ2xCLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTTtZQUN0QixNQUFNLEVBQUUsSUFBRztnQkFDVCxNQUFNLHFCQUFxQixHQUFHLE9BQU8sQ0FBQyxhQUFhLEtBQUssU0FBUyxBQUFDO2dCQUVsRSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUNyQixhQUFhO2dCQUNiLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLG9CQUFvQixFQUFFO29CQUNyQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7b0JBQ2xCLGNBQWMsRUFBRSxDQUFDLHFCQUFxQjtvQkFDdEMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxjQUFjO2lCQUN2QyxDQUFDLENBQ0gsQUFBQztnQkFFRixJQUFJLE9BQU8sQ0FBQyxhQUFhLEVBQUU7b0JBQ3pCLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQUFBQztvQkFDM0MsTUFBTSxRQUFRLEdBQXlCLElBQUksR0FBRyxFQUFFLEFBQUM7b0JBQ2pELEtBQUssTUFBTSxPQUFPLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBRTt3QkFDckMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO3FCQUNyQztvQkFDRCxNQUFNLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUU3QyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FDakIsYUFBYTtvQkFDYixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyx3QkFBd0IsRUFBRTt3QkFDekMsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTO3dCQUMxQixjQUFjLEVBQUUsT0FBTyxDQUFDLGNBQWM7cUJBQ3ZDLENBQUMsQ0FDSCxDQUFDO2lCQUNIO2dCQUVELE1BQU0sTUFBSyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQUFBQztnQkFDM0MsTUFBTSxTQUFRLEdBQXlCLElBQUksR0FBRyxFQUFFLEFBQUM7Z0JBQ2pELEtBQUssTUFBTSxRQUFPLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBRTtvQkFDckMsU0FBUSxDQUFDLEdBQUcsQ0FBQyxRQUFPLENBQUMsSUFBSSxFQUFFLFFBQU8sQ0FBQyxDQUFDO2lCQUNyQztnQkFDRCxNQUFNLFNBQVMsR0FBMEIsSUFBSSxHQUFHLEVBQUUsQUFBQztnQkFDbkQsS0FBSyxNQUFNLFFBQVEsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFFO29CQUN2QyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDLENBQUM7aUJBQy9DO2dCQUNELE1BQU0sT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFLLEVBQUUsU0FBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUU3QyxJQUFJLENBQUMsS0FBSyxDQUNSLGFBQWE7Z0JBQ2IsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsMEJBQTBCLEVBQUU7b0JBQzNDLFNBQVMsRUFBRSxNQUFLLENBQUMsU0FBUztpQkFDM0IsQ0FBQyxDQUNILENBQUM7YUFDSDtTQUNGLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxHQUFHLENBQUMsT0FBc0IsRUFBRTtRQUNqQyxhQUFhO1FBQ2IsSUFBSSxDQUFDLElBQUksQ0FBQztZQUNSLElBQUksRUFBRSxnQkFBZ0I7WUFDdEIsTUFBTSxFQUFFLElBQUc7Z0JBQ1QsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FDdkIsYUFBYTtnQkFDYixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsRUFBRTtvQkFDckMsSUFBSSxFQUFFLGdCQUFnQjtvQkFDdEIsY0FBYyxFQUFFLElBQUk7b0JBQ3BCLGNBQWMsRUFBRSxTQUFTO2lCQUMxQixDQUFDLENBQ0gsQUFBQztnQkFDRixNQUFNLFFBQVEsR0FBeUIsSUFBSSxHQUFHLEVBQUUsQUFBQztnQkFDakQsS0FBSyxNQUFNLE9BQU8sSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFFO29CQUNyQyxRQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7aUJBQ3JDO2dCQUNELE1BQU0sU0FBUyxHQUEwQixJQUFJLEdBQUcsRUFBRSxBQUFDO2dCQUNuRCxLQUFLLE1BQU0sUUFBUSxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUU7b0JBQ3ZDLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztpQkFDL0M7Z0JBQ0QsTUFBTSxXQUFXLEdBQWU7b0JBQzlCLEdBQUcsRUFBRSxNQUFNLENBQUMsZUFBZTtpQkFDNUIsQUFBQztnQkFDRixNQUFNLE9BQU8sQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQzthQUNwRDtTQUNGLENBQUMsQ0FBQztLQUNKO0NBQ0Y7QUFFRCxPQUFPLElBQVUsS0FBSyxDQXFGckI7O0lBcEZDLE1BQU0sU0FBUyxHQUFhLEVBQUUsQUFBQztJQUMvQixJQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFFO1FBQzlCLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQUFBQztRQUNqRCxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQzFCO0lBRUQsU0FBUyxjQUFjLENBQUMsS0FBOEIsRUFBRTtRQUN0RCxNQUFNLEtBQUssR0FBa0IsRUFBRSxBQUFDO1FBQ2hDLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFFO1lBQ2hELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDeEIsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO2FBQ2xELE1BQU0sSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTtnQkFDL0MsS0FBSyxDQUFDLElBQUksQ0FDUixDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsS0FBSyxDQUE0QixDQUFDLEVBQUUsQ0FBQyxDQUNsRSxDQUFDO2FBQ0gsTUFBTTtnQkFDTCxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNoQztTQUNGO1FBQ0QsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3pCO0lBRU0sU0FBUyxFQUFFLENBQUMsR0FBVyxFQUFFO1FBQzlCLE9BQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ3RCO1VBRmUsRUFBRSxHQUFGLEVBQUU7SUFJWCxTQUFTLEdBQUcsQ0FBQyxHQUFXLEVBQUU7UUFDL0IsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDdkI7VUFGZSxHQUFHLEdBQUgsR0FBRztJQUlaLFNBQVMsSUFBSSxDQUFDLEdBQVcsRUFBRTtRQUNoQyxPQUFPLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN4QjtVQUZlLElBQUksR0FBSixJQUFJO0lBSWIsU0FBUyxJQUFJLEdBQUc7UUFDckIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ2Y7VUFGZSxJQUFJLEdBQUosSUFBSTtJQUliLFNBQVMsSUFBSSxDQUFDLEdBQVksRUFBRTtRQUNqQyxPQUFPLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQ2pCO1VBRmUsSUFBSSxHQUFKLElBQUk7SUFJYixTQUFTLEdBQUcsQ0FBQyxHQUFvQixFQUFFO1FBQ3hDLE9BQU8sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7S0FDakI7VUFGZSxHQUFHLEdBQUgsR0FBRztJQUlaLFNBQVMsSUFBSSxDQUFDLEdBQW9CLEVBQUU7UUFDekMsT0FBTyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQ2xCO1VBRmUsSUFBSSxHQUFKLElBQUk7SUFJYixTQUFTLEtBQUssQ0FBQyxHQUFXLEVBQUU7UUFDakMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0tBQzVCO1VBRmUsS0FBSyxHQUFMLEtBQUs7SUFJZCxTQUFTLElBQUksQ0FBQyxHQUFXLEVBQUU7UUFDaEMsT0FBTyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNsQztVQUZlLElBQUksR0FBSixJQUFJO0lBSWIsU0FBUyxJQUFJLENBQUMsR0FBeUIsRUFBRTtRQUM5QyxNQUFNLElBQUksR0FDUixPQUFPLEdBQUcsSUFBSSxRQUFRLEdBQ2xCLElBQUksV0FBVyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUM3QixJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQUFBQztRQUUxQixNQUFNLFNBQVMsR0FBRyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEFBQUM7UUFFekMsSUFBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUU7WUFDcEMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNuQztRQUVELE9BQU8sQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDbEM7VUFiZSxJQUFJLEdBQUosSUFBSTtJQWViLFNBQVMsSUFBSSxDQUFDLEdBQW1CLEVBQUU7UUFDeEMsT0FBTyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2xDO1VBRmUsSUFBSSxHQUFKLElBQUk7SUFJYixTQUFTLFNBQVMsQ0FBQyxHQUFXLEVBQUU7UUFDckMsT0FBTyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQ2xCO1VBRmUsU0FBUyxHQUFULFNBQVM7SUFJbEIsU0FBUyxLQUFLLENBQUMsR0FBNEIsRUFBRTtRQUNsRCxPQUFPLENBQUMsRUFBRSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUNyQztVQUZlLEtBQUssR0FBTCxLQUFLO0dBbEZOLEtBQUssS0FBTCxLQUFLO0FBd0p0Qiw2QkFBNkI7QUFDN0IsU0FBUyxPQUFPLENBQUMsR0FBVyxFQUFFLFdBQW1CLEVBQUUsT0FBZ0IsRUFBRTtJQUNuRSxJQUFJLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEFBQUM7SUFDL0IsSUFBSSxJQUFJLEdBQUcsV0FBVyxDQUFDLE1BQU0sQUFBQztJQUM5QixJQUFJLENBQUMsT0FBTyxJQUFJLEdBQUcsS0FBSyxXQUFXLEVBQUU7UUFDbkMsTUFBTSxJQUFJLEtBQUssQ0FDYixDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQ3hFLENBQUM7S0FDSDtJQUNELElBQUksT0FBTyxFQUFFO1FBQ1gsSUFBSSxJQUFJLENBQUMsQ0FBQztLQUNYO0lBQ0QsSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLElBQUksRUFBRTtRQUNyQixNQUFNLElBQUksS0FBSyxDQUNiLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FDeEUsQ0FBQztLQUNIO0lBQ0QsSUFBSSxPQUFPLEVBQUU7UUFDWCxHQUFHLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztLQUN4QztJQUNELE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsQUFBQztJQUM3QyxJQUFJLEdBQUcsS0FBSyxXQUFXLEVBQUU7UUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FDYixDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQ3hFLENBQUM7S0FDSDtJQUNELElBQUksT0FBTyxHQUFHLENBQUMsQUFBQztJQUNoQixJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsRUFBRTtRQUMxQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0tBQ2I7SUFDRCxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLEFBQUM7SUFDOUQsT0FBTyxTQUFTLENBQUM7Q0FDbEI7QUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxXQUFZO0lBQ3RDLE9BQU8sT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7Q0FDbEMsQ0FBQztBQUVGLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLFdBQVk7SUFDdkMsT0FBTyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztDQUNuQyxDQUFDO0FBRUYsTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsV0FBWTtJQUN4QyxPQUFPLE9BQU8sQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0NBQ3BDLENBQUM7QUFFRixNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxXQUFZO0lBQ3hDLE9BQU8sT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7Q0FDckMsQ0FBQztBQUVGLE1BQU0sQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLFNBQVUsS0FBYyxFQUFFO0lBQ3RELElBQUk7UUFDRixPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ2xDLENBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxNQUFNLEtBQUssQ0FBQztLQUNiO0lBQ0QsT0FBTyxLQUFLLENBQUM7Q0FDZCxDQUFDO0FBRUYsTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsU0FBVSxLQUFzQixFQUFVO0lBQ3RFLElBQUk7UUFDRixPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDbkMsQ0FBQyxPQUFPLEtBQUssRUFBRTtRQUNkLE1BQU0sS0FBSyxDQUFDO0tBQ2I7SUFDRCxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUN0QixDQUFDO0FBRUYsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsU0FBVSxLQUFzQixFQUFVO0lBQ3JFLElBQUk7UUFDRixPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ2xDLENBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxNQUFNLEtBQUssQ0FBQztLQUNiO0lBQ0QsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDdEIsQ0FBQztBQUVGLE1BQU0sQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLFNBQVUsS0FBa0IsRUFBRTtJQUMxRCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxBQUFDO0lBQ2pDLElBQUksSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQzNFO0lBQ0QsT0FBTyxLQUFLLENBQUM7Q0FDZCxDQUFDO0FBRUYsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsU0FBVSxLQUFhLEVBQUU7SUFDdEQsSUFBSTtRQUNGLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3BDLENBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxNQUFNLEtBQUssQ0FBQztLQUNiO0lBQ0QsT0FBTyxLQUFLLENBQUM7Q0FDZCxDQUFDO0FBRUYsTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsU0FBVSxLQUFhLEVBQUU7SUFDckQsSUFBSTtRQUNGLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3JDLENBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxNQUFNLEtBQUssQ0FBQztLQUNiO0lBQ0QsT0FBTyxLQUFLLENBQUM7Q0FDZCxDQUFDO0FBRUYsTUFBTSxDQUFDLFNBQVMsQ0FBQyxlQUFlLEdBQUcsU0FBVSxLQUFhLEVBQUU7SUFDMUQsSUFBSTtRQUNGLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDbEMsQ0FBQyxPQUFPLEtBQUssRUFBRTtRQUNkLE1BQU0sS0FBSyxDQUFDO0tBQ2I7SUFDRCxPQUFPLEtBQUssQ0FBQztDQUNkLENBQUM7QUFFRixNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxXQUFZO0lBQ3hDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtRQUNsRSxNQUFNLElBQUksS0FBSyxDQUNiLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FDL0QsQ0FBQztLQUNIO0lBRUQsTUFBTSxLQUFLLEdBQUcsRUFBRSxBQUFDO0lBQ2pCLE1BQU0sUUFBUSxHQUFHLEVBQUUsQUFBQztJQUNwQixJQUFJLEtBQUssR0FBRyxDQUFDLEFBQUM7SUFDZCxJQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBRTtRQUNwQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO1lBQy9DLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN4QyxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNmO1FBQ0QsSUFBSTtZQUFDLEdBQUc7WUFBRSxHQUFHO1lBQUUsR0FBRztTQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUM1QyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM1QjtRQUNELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQzdELEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztTQUNiO1FBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7WUFDN0QsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1NBQ2I7UUFDRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUM3RCxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDYjtLQUNGO0lBQ0QsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQUFBQztJQUN6RCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3hCLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDMUI7SUFDRCxPQUFPLFFBQVEsQ0FBQztDQUNqQixDQUFDO0FBRUYsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsV0FBWTtJQUN6QyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7UUFDbEUsTUFBTSxJQUFJLEtBQUssQ0FDYixDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQ2hFLENBQUM7S0FDSDtJQUVELElBQUksS0FBSyxHQUFHLENBQUMsQUFBQztJQUNkLE1BQU0sS0FBSyxHQUFHLEVBQUUsQUFBQztJQUNqQixNQUFNLFFBQVEsR0FBRyxFQUFFLEFBQUM7SUFDcEIsSUFBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUU7UUFDcEMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtZQUMvQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEMsS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDZjtRQUNELElBQUk7WUFBQyxHQUFHO1lBQUUsR0FBRztZQUFFLEdBQUc7U0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDNUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDNUI7UUFDRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUM3RCxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDYjtRQUNELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQzdELEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztTQUNiO1FBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7WUFDN0QsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1NBQ2I7S0FDRjtJQUNELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEFBQUM7SUFDekQsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUN4QixRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQzFCO0lBRUQsTUFBTSxLQUFLLEdBQTJCLEVBQUUsQUFBQztJQUN6QyxLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsQ0FBRTtRQUM5QixJQUFLLElBQUksRUFBQyxHQUFHLENBQUMsRUFBRSxFQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFDLEVBQUUsQ0FBRTtZQUN2QyxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBQyxDQUFDLEtBQUssR0FBRyxFQUFFO2dCQUM3QixNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQUFBQztnQkFDM0MsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEFBQUM7Z0JBQzlDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7Z0JBQ25CLE1BQU07YUFDUDtTQUNGO0tBQ0Y7SUFFRCxPQUFPLEtBQUssQ0FBQztDQUNkLENBQUM7QUFFRixLQUFLLENBQUMsU0FBUyxDQUFDLHNCQUFzQixHQUFHLFNBQVUsTUFBTSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUU7SUFDNUUsS0FBSyxNQUFNLEVBQUUsa0JBQWtCLENBQUEsRUFBRSxJQUFJLElBQUksQ0FBRTtRQUN6QyxJQUFJO1lBQ0YsT0FBTztnQkFDTCxNQUFNLEVBQUUsa0JBQWtCLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7Z0JBQ25ELE1BQU0sRUFBRSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQztnQkFDekQsU0FBUyxFQUFFLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDO2FBQ25FLENBQUM7U0FDSCxDQUFDLE9BQU8sTUFBTSxFQUFFO1lBQ2YsU0FBUztTQUNWO0tBQ0Y7SUFDRCxNQUFNLElBQUksS0FBSyxDQUFDLDhDQUE4QyxDQUFDLENBQUM7Q0FDakUsQ0FBQztBQUVGLEtBQUssQ0FBQyxTQUFTLENBQUMsZ0NBQWdDLEdBQUcsU0FDakQsTUFBTSxFQUNOLE1BQU0sRUFDTixTQUFTLEVBQ1QsT0FBTyxFQUNQO0lBQ0EsS0FBSyxNQUFNLEVBQUUsaUJBQWlCLENBQUEsRUFBRSxJQUFJLElBQUksQ0FBRTtRQUN4QyxJQUFJO1lBQ0YsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTO1lBRXBFLE9BQU87Z0JBQ0wsTUFBTSxFQUFFLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO2dCQUNsRCxNQUFNLEVBQUUsaUJBQWlCLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUM7Z0JBQ3hELFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQztnQkFDakUsT0FBTyxFQUFFLGlCQUFpQixDQUFDLGdCQUFnQjthQUM1QyxDQUFDO1NBQ0gsQ0FBQyxPQUFPLE1BQU0sRUFBRTtZQUNmLFNBQVM7U0FDVjtLQUNGO0lBQ0QsTUFBTSxJQUFJLEtBQUssQ0FDYixDQUFDLHVEQUF1RCxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FDdkgsSUFBSSxDQUNMLENBQUMsQ0FBQyxDQUNKLENBQUM7Q0FDSCxDQUFDO0FBRUYsS0FBSyxDQUFDLFNBQVMsQ0FBQyw0QkFBNEIsR0FBRyxTQUM3QyxNQUFNLEVBQ04sU0FBUyxFQUNULE9BQU8sRUFDUDtJQUNBLEtBQUssTUFBTSxFQUFFLGFBQWEsQ0FBQSxFQUFFLElBQUksSUFBSSxDQUFFO1FBQ3BDLElBQUk7WUFDRixJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTO1lBRWhFLE9BQU87Z0JBQ0wsTUFBTSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztnQkFDOUMsU0FBUyxFQUFFLGFBQWEsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQztnQkFDN0QsT0FBTyxFQUFFLGFBQWEsQ0FBQyxnQkFBZ0I7YUFDeEMsQ0FBQztTQUNILENBQUMsT0FBTyxNQUFNLEVBQUU7WUFDZixTQUFTO1NBQ1Y7S0FDRjtJQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztDQUN2RSxDQUFDO0FBRUYsS0FBSyxDQUFDLFNBQVMsQ0FBQyw0QkFBNEIsR0FBRyxTQUM3QyxNQUFNLEVBQ04sTUFBTSxFQUNOLE9BQU8sRUFDUDtJQUNBLEtBQUssTUFBTSxFQUFFLGFBQWEsQ0FBQSxFQUFFLElBQUksSUFBSSxDQUFFO1FBQ3BDLElBQUk7WUFDRixJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTO1lBRWhFLE9BQU87Z0JBQ0wsTUFBTSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztnQkFDOUMsTUFBTSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQztnQkFDcEQsT0FBTyxFQUFFLGFBQWEsQ0FBQyxnQkFBZ0I7YUFDeEMsQ0FBQztTQUNILENBQUMsT0FBTyxNQUFNLEVBQUU7WUFDZixTQUFTO1NBQ1Y7S0FDRjtJQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztDQUN2RSxDQUFDO0FBRUYsS0FBSyxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxTQUFVLGtCQUFrQixFQUFFLEtBQUssRUFBRTtJQUN0RSxLQUFLLE1BQU0sRUFBRSxjQUFjLENBQUEsRUFBRSxJQUFJLElBQUksQ0FBRTtRQUNyQyxJQUFJO1lBQ0YsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLFNBQVM7WUFDdEQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLFNBQVM7WUFFcEQsT0FBTztnQkFDTCxtQkFBbUIsRUFDakIsY0FBYyxDQUFDLG1CQUFtQixDQUFDLGVBQWUsQ0FDaEQsa0JBQWtCLENBQ25CO2dCQUNILEtBQUssRUFBRSxjQUFjLENBQUMsS0FBSztnQkFDM0IsS0FBSyxFQUFFLGNBQWMsQ0FBQyxLQUFLO2FBQzVCLENBQUM7U0FDSCxDQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2QsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNwQixTQUFTO1NBQ1Y7S0FDRjtJQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztDQUMzRCxDQUFDO0FBRUYsS0FBSyxDQUFDLFNBQVMsQ0FBQyxtQ0FBbUMsR0FBRyxTQUNwRCxPQUFPLEVBQ1AsTUFBTSxFQUNOLFNBQVMsRUFDVCxZQUFZLEVBQ1osT0FBTyxFQUNQO0lBQ0EsS0FBSyxNQUFNLEVBQUUsa0JBQWtCLENBQUEsRUFBRSxJQUFJLElBQUksQ0FBRTtRQUN6QyxJQUFJO1lBQ0YsSUFBSSxrQkFBa0IsQ0FBQyxLQUFLLEtBQUssT0FBTyxFQUFFLFNBQVM7WUFDbkQsSUFBSSxrQkFBa0IsQ0FBQyxnQkFBZ0IsS0FBSyxDQUFDLEVBQUUsWUFBWSxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUN2RSxTQUFTO1lBRVgsT0FBTztnQkFDTCxPQUFPLEVBQUUsa0JBQWtCLENBQUMsS0FBSztnQkFDakMsTUFBTSxFQUFFLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDO2dCQUN6RCxTQUFTLEVBQUUsa0JBQWtCLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUM7Z0JBQ2xFLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxnQkFBZ0I7YUFDN0MsQ0FBQztTQUNILENBQUMsT0FBTyxNQUFNLEVBQUU7WUFDZixTQUFTO1NBQ1Y7S0FDRjtJQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsMkRBQTJELENBQUMsQ0FBQztDQUM5RSxDQUFDO0FBRUYsS0FBSyxDQUFDLFNBQVMsQ0FBQywrQkFBK0IsR0FBRyxTQUNoRCxPQUFPLEVBQ1AsU0FBUyxFQUNULFlBQVksRUFDWixPQUFPLEVBQ1A7SUFDQSxLQUFLLE1BQU0sRUFBRSxjQUFjLENBQUEsRUFBRSxJQUFJLElBQUksQ0FBRTtRQUNyQyxJQUFJO1lBQ0YsSUFBSSxjQUFjLENBQUMsS0FBSyxLQUFLLE9BQU8sRUFBRSxTQUFTO1lBQy9DLElBQUksY0FBYyxDQUFDLGdCQUFnQixLQUFLLENBQUMsRUFBRSxZQUFZLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDLEVBQ25FLFNBQVM7WUFFWCxPQUFPO2dCQUNMLE9BQU8sRUFBRSxjQUFjLENBQUMsS0FBSztnQkFDN0IsU0FBUyxFQUFFLGNBQWMsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQztnQkFDOUQsT0FBTyxFQUFFLGNBQWMsQ0FBQyxnQkFBZ0I7YUFDekMsQ0FBQztTQUNILENBQUMsT0FBTyxNQUFNLEVBQUU7WUFDZixTQUFTO1NBQ1Y7S0FDRjtJQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsdURBQXVELENBQUMsQ0FBQztDQUMxRSxDQUFDO0FBRUYsS0FBSyxDQUFDLFNBQVMsQ0FBQywrQkFBK0IsR0FBRyxTQUNoRCxPQUFPLEVBQ1AsTUFBTSxFQUNOLFlBQVksRUFDWixPQUFPLEVBQ1A7SUFDQSxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBRTtRQUN4QixJQUFJO1lBQ0YsSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQUssS0FBSyxPQUFPLEVBQUUsU0FBUztZQUNyRCxJQUNFLEtBQUssQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLEtBQUssQ0FBQyxFQUFFLFlBQVksQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUMsRUFFdkUsU0FBUztZQUVYLE9BQU87Z0JBQ0wsT0FBTyxFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsZ0JBQWdCO2dCQUM5QyxPQUFPLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLO2dCQUNuQyxNQUFNLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQzthQUM1RCxDQUFDO1NBQ0gsQ0FBQyxPQUFPLE1BQU0sRUFBRTtZQUNmLFNBQVM7U0FDVjtLQUNGO0lBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO0NBQzFFLENBQUM7QUFFRixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQUFBQztBQUNyQyxNQUFNLE9BQU8sR0FBRyxDQUFDLE9BQU8sQUFBQztBQVF6QixTQUFTLElBQUksQ0FBQyxJQUFjLEVBQUUsS0FBYSxFQUFRO0lBQ2pELE9BQU87UUFDTCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0IsS0FBSyxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDdkIsTUFBTSxFQUFFLElBQUksTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUM7S0FDN0MsQ0FBQztDQUNIO0FBRUQsU0FBUyxHQUFHLENBQUMsR0FBVyxFQUFFLElBQVUsRUFBVTtJQUM1QyxPQUFPLE9BQU8sR0FDVixDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FDakUsR0FBRyxDQUFDO0NBQ1Q7QUFFRCxPQUFPLFNBQVMsR0FBRyxDQUFDLEdBQVcsRUFBVTtJQUN2QyxPQUFPLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0FBQUMsVUFBRTtLQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztDQUNqQztBQUVELE9BQU8sU0FBUyxLQUFLLENBQUMsR0FBVyxFQUFVO0lBQ3pDLE9BQU8sR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7QUFBQyxVQUFFO0tBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQ2pDIn0=