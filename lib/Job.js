"use strict";

let _ = require('lodash')

class Job {
    constructor(type, payload, cb) {
        this.type = type;
        this.payload = payload;
        this.cb = cb || _.noop;
    }
}

module.exports = Job