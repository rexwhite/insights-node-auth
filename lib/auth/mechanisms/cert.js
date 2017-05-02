/*global require, module, process*/
'use strict';

const Mechanism    = require('./mechanism');
const request      = require('request');
const certPropsArr = ['commonNameHeader', 'issuerHeader', 'hostHeader', 'trustedIssuer', 'trustedHost', 'candlepinFindOwnerUrl'];
const missingProps = [];
const priv         = {};
const certConfig   = {};

certPropsArr.forEach((prop) => {
    const envName = 'CERTAUTH_' + prop.toUpperCase();
    const envProp = process.env[envName];

    if (!envProp || envProp.trim() === '') { // wtf I cant call priv.nullEmptyOrUndefined
        missingProps.push(envName);
    }

    certConfig[prop] = envProp;
});


class CertAuth extends Mechanism {
    constructor(req, deferred) {
        super(req, deferred);
        this.certConfig = certConfig;

        // Make cert auth blow up if someone tries to use it with missing props!
        if (missingProps.length > 0) {
            missingProps.forEach((prop) => {
                this.logger('Missing prop: ' + prop);
            }, this);
            throw Error('CertAuth configuration not setup!');
        }
    }

    buildUserObject(json) {
        return {
            account_number: json.oracleCustomerNumber + '',
            org_id: json.displayName,
            is_active: true,
            is_org_admin: true,
            is_internal: false,
            sso_username: `cert-system-${json.oracleCustomerNumber}`
        };
    }

    getCacheKey(creds) {
        return creds.cn;
    }

    ensureCredentials(creds) {

        if (!creds) {
            throw new Error('Error getting headers');
        }
        //////////////
        // Host checks
        if (priv.nullEmptyOrUndefined(creds.host)) {
            throw new Error('Missing Host header');
        }

        if (creds.host !== this.certConfig.trustedHost) {
            throw new Error('Invalid host for cert auth. expected: ' + this.certConfig.trustedHost + ' actual: ' + creds.host);
        }

        ///////////
        // CN check
        if (priv.nullEmptyOrUndefined(creds.cn)) {
            throw new Error('Missing CommonName header');
        }

        ////////////////
        // Issuer checks
        if (priv.nullEmptyOrUndefined(creds.issuer)) {
            throw new Error('Missing Issuer header');
        }

        if (creds.issuer !== this.certConfig.trustedIssuer) {
            throw new Error('Invalid issuer');
        }
    }

    getCreds() {
        return {
            cn: priv.decodeCommonName(this.req.headers[this.certConfig.commonNameHeader]),
            issuer: priv.decodeIssuer(this.req.headers[this.certConfig.issuerHeader]),
            host: this.req.headers[this.certConfig.hostHeader]
        };
    }

    doRemoteCall(creds, callback) {
        const instance = this;
        request({
            headers: {
                accept: 'application/json'
            },
            uri: this.certConfig.candlepinFindOwnerUrl + creds.cn
        }, (err, res, body) => {
            if (res.statusCode !== 200) {
                return instance.fail('Got a bad statusCode from CandlePin: ' + res.statusCode);
            }

            try {
                const json = JSON.parse(body);
                callback(json);
            } catch(e) {
                return instance.fail('Unable to decode JSON from CandlePin: ' + e);
            }

            return true;
        });

    }
};

// Private functions

priv.decodeCommonName = (str) => {
    return unescape(str).replace('/CN=', '').trim();
};

priv.decodeIssuer = (str) => {
    return unescape(str).trim();
};

priv.nullEmptyOrUndefined = (str) => {
    return (!str || str.trim() === '' || str === 'undefined');
};

module.exports = CertAuth;