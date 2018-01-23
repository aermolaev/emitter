suite('Utils Emitter', function() {
    var strictMode = emitter.strict;

    setup(function() {
        emitter.strict = true;

        var Klass = function() {
            emitter(this, [
                'error',
                'event',
                'emitOnce',
                /^iq_/,
            ]);
        };

        Klass.prototype = {
            good: function(callback) {
                callback('good');
                return this;
            },
            goodAsync: function(callback) {
                setTimeout(function() {
                    callback('goodAsync');
                }, 1);

                return this;
            },
            badAsync: function() {
                var self = this;

                setTimeout(function() {
                    self.emit('error', 'badAsync');
                }, 1);

                return this;
            },

            multipleEmits: function() {
                var self = this;

                setTimeout(function() {
                    self.emit('event', 'emit_1');
                    setTimeout(function() {
                        self.emit('event', 'emit_2');
                    }, 1);
                }, 1);

                return this;
            },

            multipleEmitArgs: function() {
                var self = this;

                setTimeout(function() {
                    self.emit('event', '10', '20', '30', '40');
                    setTimeout(function() {
                        self.emit('event', '10', '60', '70', '80');
                    }, 1);
                }, 1);

                return this;
            }
        };

        this.instance = new Klass();
    });

    teardown(function() {
        emitter.strict = strictMode;
    });

    test('emitter has method trigger', function() {
        assert.strictEqual(emitter.emit, emitter.trigger);
    });

    test('has', function() {
        var instance = this.instance;
        var handlerEmits = function() {
            return 'handler emits';
        };
        var handlerEmitOnce = function() {
            return 'handler emit once';
        };

        instance.on('emits', handlerEmits);
        instance.once('emitOnce', handlerEmitOnce);

        assert.ok(instance.has('emits', handlerEmits), 'Has handler for "emits"');
        assert.ok(instance.has('emitOnce', handlerEmitOnce), 'Has once handler for "emitOnce"');

        instance.off('emits', handlerEmits);
        assert.notEqual(instance.has('emits', handlerEmits), true, 'Has NO handler for "emits"');

        instance.emit('emitOnce');
        assert.notEqual(instance.has('emitOnce', handlerEmitOnce), true, 'Has NO once handler for "emitOnce" after emit');

        instance.once('emitOnce', handlerEmitOnce);
        instance.off('emitOnce', handlerEmitOnce);
        assert.notEqual(instance.has('emitOnce', handlerEmitOnce), true, 'Has NO once handler for "emitOnce" after off');
    });

    test('off with callback !== function', function() {
        var instance = this.instance;
        var handlerEmits = function() {
            return 'handler emits';
        };
        var handlerEmitOnce = function() {
            return 'handler emit once';
        };

        instance.on('emits', handlerEmits);
        instance.off('emits', 1);
        assert.isFalse(instance.has('emits', handlerEmits));

        instance.once('emitOnce', handlerEmitOnce);
        instance.off('emitOnce', 1);
        assert.isFalse(instance.has('emitOnce', handlerEmitOnce));
    });

    test('has without callback', function() {
        function func() {
            return 'test';
        }

        var instance = emitter({}, ['one']);
        assert.isFalse(instance.has('one'), 'no handlers');

        instance.on('one', func);
        assert.isTrue(instance.has('one'), 'on handler');

        instance.off('one', func);
        assert.isFalse(instance.has('one'), 'off handler');

        instance.once('one', func);
        assert.isTrue(instance.has('one'), 'once handler');

        instance.emit('one');
        assert.isFalse(instance.has('one'), 'once off after emit');
    });

    test('emitter return the same instance', function() {
        var instance = {};
        assert.strictEqual(instance, emitter(instance), 'instance !== emitter(instance)');
    });

    test('good', function() {
        this.instance.good(function(result) {
            assert.equal(result, 'good');
        }).on('error', function() {
            throw "errorGood";
        });
    });

    test('goodAsync', function(done) {
        this.instance.goodAsync(function(result) {
            assert.equal(result, 'goodAsync');
            done();
        }).on('error', function() {
            throw "errorGoodAsync";
        });
    });

    test('badAsync', function(done) {
        this.instance.badAsync(function() {
            throw "errorBadAsync";
        }).on('error', function(result) {
            assert.equal(result, 'badAsync');
            done();
        });
    });

    test('onceEmit', function(done) {
        this.instance.multipleEmits().once('event', function(result) {
            assert.equal(result, 'emit_1');
            done();
        });
    });

    test('multipleEmit', function(done) {
        var results = '';
        var count = 0;

        this.instance.multipleEmits().on('event', function(result) {
            count++;
            results += result;

            if (count === 2) {
                assert.equal(results, 'emit_1emit_2');
                done();
            }
        });
    });

    test('twoCallbacks', function(done) {
        var results = '';

        this.instance.badAsync().on('error', function() {
            results += '1';
        }).on('error', function() {
            results += '2';
        });

        setTimeout(function() {
            assert.equal(results, '12');
            done();
        }, 30);
    });

    test('multipleEmitArgs', function(done) {
        var results = '';
        var count = 0;

        this.instance.multipleEmitArgs().on('event', function(a, b, c, d) {
            results += a + b + c + d;
            count++;
        });

        var interval = setInterval(function() {
            if (count === 2) {
                clearTimeout(interval);
                assert.equal(results, '1020304010607080');
                done();
            }
        }, 10);
    });

    test('multipleEmitArgsOnce', function(done) {
        var results = '';

        this.instance.multipleEmitArgs().once('event', function(a, b, c, d) {
            results += a + b + c + d;
        });

        setTimeout(function() {
            assert.equal(results, '10203040');
            done();
        }, 30);
    });

    test('removeListener', function(done) {
        var results = '';
        var count = 0;

        function inner1(a) {
            results += a; // 10
            instance.off('event', inner1); // выключаем после первого раза
        }

        function inner2(a, b) {
            count++;
            results += b; // 20 60

            if (count === 2) {
                assert.equal(results, '102060');
                done();
            }
        }

        var instance = this.instance.multipleEmitArgs().on('event', inner1).on('event', inner2);
    });

    test('removeOnceListener', function() {
        var result = 'off';
        var handler = function() { result = 'on'; };

        this.instance.once('event', handler);
        this.instance.off('event', handler);

        this.instance.emit('event');
        assert.equal(result, 'off', 'Same result after off event');

        this.instance.once('event', handler);
        this.instance.emit('event');
        assert.equal(result, 'on', 'New result after emit');
    });

    test('removeListenerAll', function(done) {
        var results = '';

        var instance = this.instance.multipleEmitArgs().on('event', function(a) {
            results += a;
            instance.off('event'); // выключаем после первого раза
        });

        setTimeout(function() {
            assert.equal(results, '10');
            done();
        }, 30);
    });

    test('removeListenerAll w/o type', function(done) {
        var results = '';

        var instance = this.instance.multipleEmitArgs().on('event', function(a) {
            results += a;
            instance.off(); // выключаем после первого раза
        });

        setTimeout(function() {
            assert.equal(results, '10');
            done();
        }, 30);
    });

    test('emit iq_* event', function(done) {
        var instance = this.instance;

        instance.on('iq_123', function() {
            done();
        });

        instance.emit('iq_123');
    });

    test('emit unknown event', function() {
        var instance = this.instance;

        assert.throw(function() {
            instance.emit('unknown');
        }, 'unknown emit type');

        assert.throw(function() {
            instance.emit('iq');
        }, 'unknown emit type');
    });

    test('two emitters', function() {
        var instance = {};

        emitter(instance, ['one']);
        emitter(instance, ['two']);

        assert.doesNotThrow(function() {
            instance.emit('one');
        }, 'unknown emit type');

        assert.doesNotThrow(function() {
            instance.emit('two');
        }, 'unknown emit type');
    });

    test('two emitters *', function() {
        var instance = {};

        emitter(instance, '*');
        emitter(instance, ['two']);

        assert.doesNotThrow(function() {
            instance.emit('one');
        }, 'unknown emit type');

        assert.doesNotThrow(function() {
            instance.emit('two');
        }, 'unknown emit type');
    });

    test('watch', function() {
        var count = 0;
        var instance = {};
        emitter(instance, '*');

        var unwatch = instance.watch('test', function() {
            count++;
        });

        instance.emit('test');
        instance.emit('test');
        unwatch();

        instance.emit('test');
        assert.equal(count, 2);
    });

    test('watch with off', function() {
        var count = 0;
        var instance = {};
        emitter(instance, '*');

        var func = function() {
            count++;
        };

        instance.watch('test', func);

        instance.emit('test');
        instance.emit('test');
        instance.off('test', func);

        instance.emit('test');
        assert.equal(count, 2);
    });

    test('watchOnce', function() {
        var count = 0;
        var instance = {};
        emitter(instance, '*');

        var unwatch = instance.watchOnce('test', function() {
            count++;
        });

        instance.emit('test');
        instance.emit('test');
        unwatch();

        instance.emit('test');
        assert.equal(count, 1);
    });

    test('watchOnce and unwatch', function() {
        var count = 0;
        var instance = {};
        emitter(instance, '*');

        var unwatch = instance.watchOnce('test', function() {
            count++;
        });

        unwatch();
        instance.emit('test');
        assert.equal(count, 0);
    });
});
