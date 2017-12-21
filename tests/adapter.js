"use strict";
const path = require("path"),
    assert = require("assert"),
    Adapter = require(path.join(__dirname, "..")),
    nock = require("nock");

describe("adapter", () => {

    beforeEach(() => {
        nock.cleanAll();
    });

    describe("get", () => {
        const adapter = new Adapter("http://example.com/api");
        it("return null when article is not found", () => {
            nock("http://example.com")
                .get(
                    "/api/articles?filter%5Bwhere%5D%5Bid%5D=1&filter%5Blimit%5D=1"
                )
                .reply(200, []);
            return adapter.
                get("articles", 1)
                .then(article => {
                    assert.strictEqual(article,
                        null);
                    return article;
                });
        });
        it("return article where article is found", () => {
            nock("http://example.com")
                .get(
                    "/api/articles?filter%5Bwhere%5D%5Bid%5D=081b7787-ac15-4611-b53b-54cbfa36bfe9&filter%5Blimit%5D=1"
                )
                .reply(200, [{
                    id: "081b7787-ac15-4611-b53b-54cbfa36bfe9"
                }]);
            return adapter.
                get("articles",
                    "081b7787-ac15-4611-b53b-54cbfa36bfe9"
                )
                .then(article => {
                    assert.strictEqual(article.id,
                        "081b7787-ac15-4611-b53b-54cbfa36bfe9"
                    );
                    return article;
                });
        });
    });

    describe("filter", () => {
        const adapter = new Adapter("http://example.com/api");
        it("offset", () => {
            const scope = nock("http://example.com")
                .get("/api/articles?filter%5Bskip%5D=1")
                .reply(200, []);
            return adapter.
                find("articles", {
                    offset: 1
                })
                .then(articles => {
                    assert.deepEqual(articles, []);
                    assert(scope.isDone());
                    return articles;
                });
        });
    });

    describe("error", () => {
        const adapter = new Adapter("http://example.com/api");
        it("return an error on response status > 399", () => {
            const scope = nock("http://example.com")
                .get("/api/articles?filter%5Bskip%5D=1")
                .reply(400, []);
            return adapter.
                find("articles", {
                    offset: 1
                })
                .catch(err => {
                    return err;
                })
                .then(err => {
                    assert.equal(err.status, 400);
                    assert(err instanceof Error);
                    assert(scope.isDone());
                    return err;
                });
        });
    });

    describe("authentication", () => {
        const adapter = new Adapter({
            endPoint: "http://example.com/api",
            authentication: {
                "path": "/users/login",
                "crendentials": {
                    "username": "admin",
                    "password": "admin"
                }
            }
        });
        it("return an error on authentication failed", () => {
            const scope = nock("http://example.com")
                // Non authorized request
                .get("/api/articles")
                .reply(401, [])
                // Authentication request
                .post("/api/users/login")
                .reply(401);
            return adapter.
                find("articles")
                .catch(err => {
                    return err;
                })
                .then(err => {
                    assert.equal(err.status, 401);
                    assert(err instanceof Error);
                    assert(scope.isDone());
                    return err;
                });

        });
        it("authenticate on 401", () => {
            const scope = nock("http://example.com")
                // Non authorized request
                .get("/api/articles")
                .reply(401, [])
                // Authentication request
                .post("/api/users/login")
                .reply(200, {
                    "id": "custom token"
                })
                // Authenticated request with Authorization header
                .get("/api/articles")
                .matchHeader("authorization",
                    "custom token")
                .reply(200, []);
            return adapter.
                find("articles")
                .then(articles => {
                    assert.deepEqual([], articles);
                    assert(scope.isDone());
                    return articles;
                });
        });
    });
});
