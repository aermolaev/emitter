/*
 * Emitter
 * Добавляет к экземпляру класса возможность подписываться на сообщения от экземпляра.
 * Позволяет разделить обработчики ответов.
 *
 * Пример:
 *   http.get(url, function(res) {
 *      console.log(res);
 *   }).on('error', function(err) {
 *      console.log(err);
 *   });
 *
 *   var HTTP = function() {
 *      utils.emitter(this); // <-- необходимый вызов для подключения функций
 *
 *      this.get = function(url, callback) {
 *          var self = this;
 *
 *          this.getAsync(url, function(error, result) {
 *              if (error) {
 *                  self.emit('error', error, result, someParam); // <-- эмитирует ошибку, callback не будет вызван
 *              } else {
 *                  callback(result);
 *              }
 *          });
 *
 *          return this; // <-- необходимо возвращать себя
 *      };
 *   };
 */

function Listener() {
    this.callbacks = [];
}

Listener.prototype = {
    on(callback) {
        this.callbacks.push(callback);

        return () => {
            this.off(callback);
            return callback;
        };
    },

    once(callback) {
        let unwatch;
        let inner = function() {
            unwatch();
            callback.apply(null, arguments);
        };

        inner.__emitter__originalCallback = callback;

        return (unwatch = this.on(inner));
    },

    off(callback) {
        const callbacks = this.callbacks;

        if (typeof callback === 'function') {
            this.callbacks = callbacks.filter(listener => !this.isSameCallback(listener, callback));
        } else {
            callbacks.length = 0;
        }
    },

    has(callback) {
        const callbacks = this.callbacks;

        if (callback) {
            return callbacks.some(listener => this.isSameCallback(listener, callback));
        }

        return callbacks.length > 0;
    },

    emit(args) {
        this.callbacks.forEach(callback => {
            if (callback) {
                callback.apply(null, args);
            }
        });
    },

    isSameCallback(listener, callback) {
        if (listener === callback) {
            return true;
        }

        if (listener) {
            var originalCallback = listener.__emitter__originalCallback;

            if (originalCallback) {
                return originalCallback === callback;
            }
        }

        return false;   
    },
};

const wildcard = '*'; // любой тип события
const _emitterTypes = '_emitterTypes';

let emitter = function(instance, types) {
    types = types || [];

    const emitterTypes = instance[_emitterTypes];

    if (emitterTypes) {
        if (emitterTypes !== wildcard) {
            if (types === wildcard) { // добавляется '*'
                instance[_emitterTypes] = wildcard;
            } else {
                instance[_emitterTypes] = emitterTypes.concat(types);
            }
        }
    } else {
        let listeners = {};

        instance[_emitterTypes] = types;

        const getListenerByType = function(type) {
            let listener = listeners[type];
            if (listener) {
                return listener;
            } else {
                let listener = new Listener();
                listeners[type] = listener;
                return listener;
            }
        };

        const checkEmitType = function(type) {
            const types = this[_emitterTypes];
            const typesLength = types.length;

            for (let i = 0; i < typesLength; i++) {
                let testType = types[i];

                if (testType === type) { // string
                    return false;
                } else if (testType.test && testType.test(type)) { // regexp
                    return false;
                }
            }

            return true;
        }.bind(instance);

        /**
         * Посылает сообщение.
         * @param {String} type Тип сообщения.
         * @param {...*} args Параметры сообщения.
         */
        instance.emit = function(type /* args */) {
            if (this[_emitterTypes] !== wildcard && checkEmitType(type)) {
                const klass = this.constructor.name;
                let message = 'utils.emitter: ' + klass + ' - unknown emit type "' + type + '". ';

                if (this[_emitterTypes].length === 0) {
                    message += 'Types list not defined.';
                } else {
                    message += 'Known types are: "' + types.join(', ') + '".';
                }

                if (emitter.strict) {
                    throw new Error(message);
                } else {
                    console.warn(message);
                }
            }

            getListenerByType(type).emit(getArgs(arguments));
        };

        instance.watch = function(type, callback) {
            return getListenerByType(type).on(callback);
        };

        /**
         * Подписывается на сообщение.
         * @param {String} type Тип сообщения.
         * @param {Function} callback Функция-обработчик сообщения.
         * @return {this}
         */
        instance.on = function(type, callback) {
            this.watch(type, callback);
            return this;
        };

        instance.watchOnce = function(type, callback) {
            return getListenerByType(type).once(callback);
        };

        /**
         * Подписывается на сообщение и удаляет обработчик из подписчиков.
         * @param {String} type Тип сообщения.
         * @param {Function} callback Функция-обработчик сообщения.
         * @return {this}
         */
        instance.once = function(type, callback) {
            this.watchOnce(type, callback);
            return this;
        };

        /**
         * Отписывается от приема сообщений.
         * @param {String?} type Тип сообщения.
         * @param {Function?} callback Функция-обработчик сообщения.
         * @return {this}
         */
        instance.off = function(type, callback) {
            if (type == null) {
                listeners = {};
            } else {
                getListenerByType(type).off(callback);
            }

            return this;
        };

        /**
         * Проверяет, что есть подписчик на прием сообщений.
         * @param {String} type Тип сообщения.
         * @param {Function?} callback Функция-обработчик сообщения.
         * @return {Boolean}
         */
        instance.has = function(type, callback) {
            return getListenerByType(type).has(callback);
        };
    }

    return instance;
};

function getArgs(args) {
    let len = args.length - 1;
    let result = new Array(len);

    for (let i = 0; i < len; i++) {
        result[i] = args[i + 1];
    }

    return result;
}

// Строгий режим: при проверках выдает исключение
emitter.strict = false;
