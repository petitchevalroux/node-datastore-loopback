"use strict";
const interceptor = require("rest/interceptor"),
    Promise = require("bluebird");

var authenticator = {
    setHeaders: function(headers) {
        this.headers = headers;
        return this.headers;
    },
    getHeaders: function() {
        return this.headers || {};
    },
    authorize: function(client, config, request) {
        var self = this;
        return client({
            method: "POST",
            path: config.url,
            entity: config.crendentials,
            headers: {
                "Content-Type": "application/json"
            }
        })
            .then(response => {
                self.setHeaders({
                    "Authorization": response.entity.id
                });
                return client(self.getRequest(request));
            });
    },
    getRequest: function(request) {
        return Object.assign(request, {
            headers: Object.assign(
                request.headers || {}, this.getHeaders()
            )
        });
    }
};



module.exports = interceptor({
    init: function(config) {
        return config;
    },
    request: function(request) {
        return authenticator.getRequest(request);
    },
    response: function(response, config, meta) {
        try {
            if (!response || !response.status || !response.status.code) {
                // Nock give an error in response, it's usefull for debugging
                if (response.error) {
                    throw new Error(response.error);
                }
                throw new Error("No response status " +
                    JSON.stringify({
                        "response": response
                    }));
            }
            // Authorized response
            if (response.status.code !== 401) {
                return response;
            }
            authenticator.setHeaders({});
            // Response to authentication request and 401
            // authentication failed
            // if path equal authentication path, authentication failed
            if (response.request.method === "POST" &&
                response.request.path === config.url) {
                throw Object.assign(new Error("Unauthorized"), {
                    status: 401
                });
            }
            return authenticator
                .authorize(
                    meta.client,
                    config,
                    response.request
                );
        } catch (err) {
            return Promise.reject(err);
        }
    }
});
