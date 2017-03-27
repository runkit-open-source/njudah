
const Call = (Function.prototype.call).bind(Function.prototype.call);
const Apply = (Function.prototype.call).bind(Function.prototype.apply);
const hasOwnProperty = Object.prototype.hasOwnProperty;
const is = Object.is || ObjectIs;
const ObjectKeys = Object.keys;
const ArrayConcat = Array.prototype.concat;
const { base, getArguments } = require("generic-jsx");
const ArrayFilter = Array.prototype.filter;
const isArray = Array.isArray;
const ArrayMap = Array.prototype.map;

const { deref, Cursor, isCursor, stem } = require("./cursor");

const I = require("immutable");
const isList = I.List.isList;
const isIterable = I.Iterable.isIterable;


//const Node = I.Record({ binding:null, children: null }, "Node");
//const Binding = I.Record({ function:null, attributes:null, children:null, value: null, isValue: false }, "Binding");

function Node({ binding = null, children = null })
{
    this.binding = binding;
    this.children = children;
}

function Binding({ base = null, function: aFunction = null, attributes = null, children = null, value = null })
{
    this.base = base;
    this.function = aFunction;
    this.attributes = attributes;
    this.children = children;
    this.value = value;
}

module.exports = exhaust;

function exhaust(aFunction, aPreviousResult)
{
    return exhaustBinding(toBinding(aFunction, aPreviousResult && aPreviousResult.binding), aPreviousResult); 
}

function exhaustBinding(aBinding, aPreviousResult)
{
    const previousBinding = aPreviousResult && aPreviousResult.binding;

    if (previousBinding && (previousBinding === aBinding || Binding.is(previousBinding, aBinding)))
        return aPreviousResult;

    if (!aBinding.base)
        return new Node({ binding: aBinding });

    const resultValue = aBinding.function();
    const previousChildren = aPreviousResult && aPreviousResult.children;

    if (!isFunction(resultValue))
        return new Node({ binding: aBinding });

    if (base(resultValue) !== stem)
        return new Node(
        {
            binding: aBinding,
            children: [exhaust(resultValue, previousChildren && previousChildren[0])]
        });

    const { children = [] } = getArguments(resultValue);

    return new Node(
    {
        binding: aBinding,
        children: [].concat(...children.map(toArray)).map((aChild, anIndex) => exhaust(aChild, previousChildren && previousChildren[anIndex]))
    });

    const children2 = base(resultValue) !== stem ?
        [exhaust(resultValue, previousChildren && previousChildren[0])] :
        aBinding.children.map((aChild, anIndex) => exhaustBinding(aChild, previousChildren && previousChildren[anIndex]));

    return new Node(
    {
        binding: aBinding,
        children
    });
}

function isFunction(aValue)
{
    return typeof aValue === "function";
}

function toBinding(aValue, aPreviousBinding)
{
    if (typeof aValue !== "function")
        return  aPreviousBinding && !aPreviousBinding.base && is(aValue, aPreviousBinding.value) ?
                aPreviousBinding : new Binding({ value: aValue });

    const { children, ...attributes } = getArguments(aValue);
    const flat = Apply(ArrayConcat, [], children.map(toArray));//Apply(ArrayConcat, [], Call(ArrayMap, children, toArray));

    return new Binding(
    {
        base: base(aValue),
        function: aValue,
        attributes: serialize(attributes),
        children: flat.map(toBinding)//Call(ArrayMap, flat, toBinding)
    });
}

function toArray(anArray)
{
    if (isArray(anArray))
        return anArray;

    if (isList(anArray))
        return anArray.toArray();

    return anArray;
}

function serialize(attributes)
{
    const keys = Object.keys(attributes);
    const serialized = Object.create(null);
    const EMPTY = { };

    var index = 0;
    const count = keys.length;

    for (; index < count; ++index)
        serialized[keys[index]] = serialize(attributes[keys[index]]);

    function serialize(anAttribute)
    {
        if (!isCursor(anAttribute))
            return { value: deref(anAttribute) };

        const value = deref(anAttribute, EMPTY);

        if (value === EMPTY)
            return { keyPath: anAttribute.keyPath };

        return { keyPath: anAttribute.keyPath, value: deref(anAttribute, EMPTY) };
    }

    return serialized;
}

function compare(lhs, rhs, depth)
{
    if (is(lhs, rhs))
        return true;

    var lhsIsIterable = isIterable(lhs);
    var rhsIsIterable = isIterable(rhs); 

    if (lhsIsIterable !== rhsIsIterable || lhsIsIterable || rhsIsIterable)
        return false;

    var lhsType = typeof lhs;
    var rhsType = typeof rhs;

    if (lhsType !== "object" || lhs === null || rhsType !== 'object' || rhs === null)
        return false;

    if (Object.getPrototypeOf(lhs) !== Object.getPrototypeOf(rhs))
        return false;

    if ((lhs instanceof Date && rhs instanceof Date) ||
        (lhs instanceof RegExp && rhs instanceof RegExp) ||
        (lhs instanceof String && rhs instanceof String) ||
        (lhs instanceof Number && rhs instanceof Number))
        if (lhs.toString() !== rhs.toString())
            return false;

    var lhsKeys = Object.keys(lhs);
    var rhsKeys = Object.keys(rhs);

    if (lhsKeys.length !== rhsKeys.length)
        return false;

    var childCompare = depth > 1 ? compare : is;

    // Test for A's keys different from B.
    for (var i = 0; i < lhsKeys.length; i++)
    {
        var key = lhsKeys[i];

        if (!hasOwnProperty.call(rhs, key) || !childCompare(lhs[key], rhs[key]))
            return false;
    }

    return true;
}


Node.prototype.toString = function (depth = 0)
{
    var index = 0;
    var padding = "";

    for (;index < depth; ++index)
        padding += "    ";

    if (!this.binding.base)
        return padding + this.binding.value;

    const binding = this.binding;
    const children = this.children
        .filter(aNode => !!aNode)
        .map(aNode => aNode.toString(depth + 1))
        .join("\n");
    return padding + "<" + binding.function.name + " " + Object.keys(binding.attributes).map(aKey =>
    {
    if (aKey === "settings") return "";
    if (aKey === "state") return "";
        return "\"" + aKey + "\" = " + toJSON(binding.attributes[aKey].value);
    }).join(" ") + (children.length > 0 ? ">\n" + children + "\n" + padding + "</" + binding.function.name + ">" : "/>");
}

function toJSON(anObject)
{
    try
    {
        return JSON.stringify(anObject);
    }
    catch (e)
    {console.log("CANT FIGURE OUT " + Object.keys(anObject));
        return "what";
    }
}

Binding.is_ = function (previous, aFunction)
{
    
}


Binding.is = function(lhs, rhs, p)
{
    const lhsIsValue = !lhs.base;
    const rhsIsValue = !rhs.base;

    if (lhsIsValue !== rhsIsValue)
        return false;

    if (lhsIsValue)
        return is(lhs.value, rhs.value);

    return  lhs.base === rhs.base &&
            every(lhs.attributes, rhs.attributes, equalAttributes) &&
            every(lhs.children, rhs.children, Binding.is);
}

function every(lhs, rhs, equals)
{
    const lhsKeys = ObjectKeys(lhs);
    const rhsKeys = ObjectKeys(rhs);

    if (lhsKeys.length !== rhsKeys.length)
        return false;

    var index = 0;
    const count = rhsKeys.length;

    for (; index < count; ++index)
        if (!equals(lhs[lhsKeys[index]], rhs[lhsKeys[index]]))
            return false;

    return true;
}

function equalAttributes(lhs, rhs)
{
    const lhsIsCursor = Call(hasOwnProperty, lhs, "keyPath");
    const rhsIsCursor = Call(hasOwnProperty, rhs, "keyPath");

    if (lhsIsCursor !== rhsIsCursor)
        return false;

    if (lhsIsCursor)
    {
        const lhsHasValue = Call(hasOwnProperty, lhs, "value");
        const rhsHasValue = Call(hasOwnProperty, rhs, "value");

        if (lhsHasValue !== rhsHasValue)
            return false;

        if (!lhsHasValue)
            return true;
    }

    return compare(lhs.value, rhs.value, 2);
}

function ObjectIs(x, y)
{
    // SameValue algorithm
    if (x === y)
    {
        // Steps 1-5, 7-10
        // Steps 6.b-6.e: +0 != -0
        return x !== 0 || 1 / x === 1 / y;
    }

    else
    {
        // Step 6.a: NaN == NaN
        return x !== x && y !== y;
    }
};



