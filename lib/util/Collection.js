class Collection extends Map {
    constructor(base, limit) {
        super();
        this.base = base;
        this.limit = limit;
    }

    add(object, extra, replace) {
        if (this.limit == 0) {
            return object instanceof this.base || object.constructor.name === this.base.name ? object : new this.base(object, extra);
        }

        if (object.id == null) {
            throw new Error("Missing object id");
        }

        const existing = this.get(object.id);

        if (existing && !replace) {
            return existing;
        }

        if (!(object instanceof this.base || object.constructor.name === this.base.name)) {
            object = new this.base(object, extra);
        }

        this.set(object.id, object);

        if (this.limit && this.size > this.limit) {
            const iterator = this.keys();

            while (this.size > this.limit) {
                this.delete(iterator.next().value);
            }
        }

        return object;
    }

    find(fn) {
        for (const item of this.values()) {
            if (fn(item)) {
                return item;
            }
        }


    }

    random() {
        if (!this.size) {
            return;
        }

        return Array.from(this.values())[Math.floor(Math.random() * this.size)];
    }

    filter(fn) {
        const array = [];

        for (const item of this.values()) {
            if (fn(item)) {
                array.push(item);
            }
        }

        return array;
    }

    map(fn) {
        const array = [];

        for (const item of this.values()) {
            array.push(fn(item));
        }

        return array;
    }

    update(object, extra, replace) {
        if (!object.id && object.id !== 0) {
            throw new Error("Missing object id");
        }

        const item = this.get(object.id);

        if (!item) {
            return this.add(object, extra, replace);
        }

        item.update(object, extra);

        return item;
    }

    remove(object) {
        const item = this.get(object.id);

        if (!item) {
            return null;
        }

        this.delete(object.id);

        return item;
    }

    toString() {
        return `[Collection<${this.base.name}>]`;
    }
}

module.exports = Collection;