/*global require, process, module*/

module.exports.getMocks = () => {
    const priv = {};

    priv.req = {
        cookies: { },
        get: (str) => { throw new Error(`TestError: unimplemented req.get("${str}")`); }
    };

    priv.res = {
        end: () => {},
        json: () => {},
        status: () => {
            return priv.res;
        }
    };

    priv.next = () => { };

    priv.app = {
        use: (cb) => { cb(priv.req, priv.res, priv.next); }
    };

    return {
        addCookie: (key, val) => {
            priv.req.cookies[key] = val;
        },
        app:  priv.app,
        req:  priv.req,
        res:  priv.res,
        next: priv.next
    };
};
