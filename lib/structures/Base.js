class Base {
    constructor(id) {
        this.id = id;
    }

    toJSON(simple) {
        if (simple) {
            return {"id": this.id};
        }

        const base = {};

        for (const key in this) {
            if (!(key in base) && key in this && !key.startsWith("_")) {
                if (!this[key]) {
                    base[key] = this[key];
                } else if (this[key] instanceof Set) {
                    base[key] = Array.from(this[key]);
                } else if (this[key] instanceof Map) {
                    base[key] = Array.from(this[key].values());
                } else if (typeof this[key].toJSON === "function") {
                    base[key] = this[key].toJSON();
                } else {
                    base[key] = this[key];
                }
            }
        }

        return base;
    }
}

module.exports = Base;