"use strict";
const interceptor = require("rest/interceptor"),
    Promise = require("bluebird");

function authorize(client, config) {
    return client({
        method: "POST",
        path: config.url,
        entity: config.crendentials,
        headers: {
            "Content-Type": "application/json"
        }
    })
        .then(response => {
            return response.entity.id;
        });
}

module.exports = interceptor({
    init: function(config) {
        return config;
    },
    request: function(request) {
        return request;
    },
    response: function(response, config, meta) {
        try {
            if (!response || !response.status || !response.status.code) {
                throw new Error("No response status");
            }
            // Authorized response
            if (response.status.code !== 401) {
                return response;
            }
            // Response to authentication request and 401
            // authentication failed
            // if path equal authentication path, authentication failed
            if (response.request.method === "POST" &&
                response.request.path === config.url) {
                throw Object.assign(new Error("Unauthorized"), {
                    status: 401
                });
            }
            return authorize(meta.client, config)
                .then(token => {
                    response.request.headers = Object.assign(
                        response.request.headers || {}, {
                            "Authorization": token
                        }
                    );
                    return meta.client(response.request);
                });
        } catch (err) {
            return Promise.reject(err);
        }
    }
});
