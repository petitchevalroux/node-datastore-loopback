"use strict";
const path = require("path"),
    querystring = require("qs"),
    rest = require("rest"),
    mimeInterceptor = require("rest/interceptor/mime"),
    authenticationInterceptor = require(path.join(__dirname, "interceptors",
        "authentication")),
    Promise = require("bluebird");

class DatastoreLoopbackAdapter {
    constructor(options) {
        if (typeof(options) === "string") {
            options = {
                endPoint: options
            };
        }
        this.endPoint = options.endPoint;
        if (options.authentication && options.authentication.path) {
            options.authentication.url = this.endPoint + options.authentication
                .path;
        }
        // We can't use pathPrefix with authentication as we can't compare path
        this.client = rest.wrap(mimeInterceptor);
        if (options.authentication) {
            this.client = this.client.wrap(
                authenticationInterceptor,
                options.authentication
            );
        }
    }

    /**
     * Get object by id, if not found object is null 
     * @param {String} type
     * @param {String} id
     * @returns {Promise}
     */
    get(type, id) {
        return this
            .find(type, {
                "filter": {
                    "id": id
                },
                "limit": 1
            })
            .then(function(rows) {
                if (rows.length < 1) {
                    return null;
                }
                return rows[0];
            });
    }

    getPathFromType(type) {
        return "/" + type;
    }

    find(type, options) {
        return this.request("GET", this.getPathFromType(type), options);
    }

    request(method, path, params) {
        const self = this;
        return this.getQueryString(params)
            .then(queryString => {
                return self.client({
                    method: method,
                    path: self.endPoint + path + queryString
                });
            })
            .then(response => {
                if (response.status.code > 399) {
                    return Promise.reject(Object.assign(
                        new Error(response.entity &&
                            response.entity.error &&
                            response.entity.error.message ?
                            response.entity.error.message :
                            ("error status: " +
                                response.status.code)
                        ), {
                            status: response.status.code
                        }
                    ));
                }
                return response.entity || null;
            });
    }
    /**
     * Return query string from params object
     * @param {Object} params
     * @returns {Promise}
     */
    getQueryString(params) {
        const self = this;
        return new Promise(resolve => {
            if (!params) {
                return resolve("");
            }
            const filter = {};
            if (params.filter) {
                filter.where = self.getWhere(params.filter);
            }
            if (params.limit) {
                filter.limit = Number(params.limit);
            }
            if (params.offset) {
                filter.skip = Number(params.offset);
            }
            resolve(Object.getOwnPropertyNames(filter)
                .length ? "?" + querystring.stringify({
                    "filter": filter
                }) : "");
        });
    }

    /**
     * Return loopback formatted where
     * @param {object} filter
     * @returns {object}
     */
    getWhere(filter) {
        const where = [],
            self = this;
        Object
            .getOwnPropertyNames(filter)
            .forEach(property => {
                where[property] = self.getWhereValue(filter[property]);
            });
        return where;
    }

    /**
     * Return loopback formatted where value
     * @param {mixed} value
     * @returns {mixed}
     */
    getWhereValue(value) {
        const typeOfValue = typeof(value);
        if (typeOfValue !== "object") {
            return value;
        } else if (Array.isArray(value)) {
            return {
                inq: value
            };
        } else {
            return value;
        }
    }

}

module.exports = DatastoreLoopbackAdapter;
