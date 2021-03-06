describe('Async Lock', function () {
    var AsyncLock = require('./../index').AsyncLock;
    var expect = require('chai').expect;

    beforeEach(function () {
        AsyncLock.__reset();
    });

    describe('Real examples', function () {
        function delay(balance, callback) {
            setTimeout(function () {
                callback(balance);
            }, 10);
        }

        it('should calculate incorrect balance without the lock', function (done) {
            var count = 0;
            var balance = { //Simulate a value stored on a remote server
                value: 100
            };

            function updateBalance() {
                delay(balance.value, function (value) { //simulate reading the balance from remote server
                    value -= 10;
                    delay(value, function (value) { // simulate writing the balance back to remove server
                        balance.value = value;
                        if (count === 0) {
                            count++;
                            return;
                        }
                        expect(balance.value).to.be.equal(90);
                        done();
                    });
                });
            }

            updateBalance();
            updateBalance();
        });

        it('should calculate correct balance with the lock', function (done) {
            var count = 0;
            var balance = {
                value: 100
            };
            this.timeout(5000);
            var lock = new AsyncLock();

            function updateBalance() {
                lock.enter(function (token) {
                    delay(balance.value, function (value) {
                        value -= 10;
                        delay(value, function (value) {
                            balance.value = value;
                            if (count === 0) {
                                count++;
                                lock.leave(token);
                                return;
                            }
                            expect(balance.value).to.be.equal(80);
                            done();
                        });
                    });
                });
            }

            updateBalance();
            updateBalance();
        });
    });

    describe('Helper functions', function () {
        it('should create tokens with different ids', function () {
            var lock = new AsyncLock();
            var token1 = lock.createToken();
            var token2 = lock.createToken();
            expect(token1.id).not.to.be.equal(token2.id);
        });

        it('should execute a callback asynchronously', function (done) {
            var lock = new AsyncLock();
            var flag = true;
            var callback = function () {
                expect(flag).to.be.false;
                done();
            };
            var token = lock.createToken(callback);
            lock.executeCallback(token);
            flag = false;

        });

        describe('Reduce Queue', function () {
            it('should return an empty list if maxQueueSize is not a number', function () {
                var lock = new AsyncLock();
                var queue = [];
                expect(lock.reduceQueue(queue, {maxQueueSize: 'a'}).length).to.be.equal(0);
                expect(lock.reduceQueue(queue, {maxQueueSize: NaN}).length).to.be.equal(0);
            });

            it('should return an empty list if overflowStrategy is not one of first,last,this', function () {
                var lock = new AsyncLock();
                var queue = ['a', 'b', 'c', 'd'];
                expect(lock.reduceQueue(queue, {maxQueueSize: 1, overflowStrategy: 'moo'}).length).to.be.equal(0);
            });

            it('should return an empty list if maxQueueSize is larger than actual queue size', function () {
                var lock = new AsyncLock();
                var queue = ['a', 'b', 'c', 'd'];
                expect(lock.reduceQueue(queue, {maxQueueSize: 5, overflowStrategy: 'last'}).length).to.be.equal(0);
            });

            it('should reduce the last elements of the queue if overflowStrategy is last', function () {
                var lock = new AsyncLock();
                var queue = ['a', 'b', 'c', 'd'];
                var reducedQueue = lock.reduceQueue(queue, {maxQueueSize: 2, overflowStrategy: 'last'});
                expect(queue.length).to.be.equal(2);
                expect(queue[0]).to.be.equal('a');
                expect(queue[1]).to.be.equal('d');
                expect(reducedQueue.length).to.be.equal(2);
                expect(reducedQueue[0]).to.be.equal('b');
                expect(reducedQueue[1]).to.be.equal('c');

            });

            it('should reduce the first elements of the queue if overflowStrategy is first', function () {
                var lock = new AsyncLock();
                var queue = ['a', 'b', 'c', 'd'];
                var reducedQueue = lock.reduceQueue(queue, {maxQueueSize: 2, overflowStrategy: 'first'});
                expect(queue.length).to.be.equal(2);
                expect(queue[0]).to.be.equal('c');
                expect(queue[1]).to.be.equal('d');
                expect(reducedQueue.length).to.be.equal(2);
                expect(reducedQueue[0]).to.be.equal('a');
                expect(reducedQueue[1]).to.be.equal('b');
            });

            it('should reduce only the last element of the queue if overflowStrategy is this', function () {
                var lock = new AsyncLock();
                var queue = ['a', 'b', 'c', 'd'];
                var reducedQueue = lock.reduceQueue(queue, {maxQueueSize: 2, overflowStrategy: 'this'});
                expect(queue.length).to.be.equal(3);
                expect(queue[0]).to.be.equal('a');
                expect(queue[1]).to.be.equal('b');
                expect(queue[2]).to.be.equal('c');
                expect(reducedQueue.length).to.be.equal(1);
                expect(reducedQueue[0]).to.be.equal('d');
            });

        });

    });

    describe('Enter a lock', function () {

        it('should return a token', function (done) {
            var lock = new AsyncLock();
            var token = lock.enter(function (innerToken) {
                expect(token.id).to.be.equal(innerToken.id);
                done();
            });

        });

        it('should execute the first entrant', function (done) {
            var lock = new AsyncLock();
            lock.enter(function () {
                done();
            });

        });

        it('should allow only one execution within a lock', function (done) {
            var lock = new AsyncLock();
            lock.enter(function () {
                lock.enter(function () {
                    done('Should not be here');
                });
                done();
            });

        });

        it('should not allow entering with a non function', function () {
            var lock = new AsyncLock();
            expect(function () {
                lock.enter('hello world');
            }).to.throw('Callback must be a function');
        });

        it('should throw if createToken returns null', function () {
            var lock = new AsyncLock();
            lock.createToken = function () {
                return null;
            };
            expect(function () {
                lock.enter(function () {
                });
            }).to.throw('Token cannot be null or undefined');
        });

        it('should not call the callback if the timeout has expired and do call it if not expired', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (innerToken) {
                setTimeout(function () {
                    lock.leave(innerToken);

                }, 100);
            });
            lock.enter(function () {
                done('error');
            }, 10);

            lock.enter(function () {
                done();
            }, 1000);

        });

        describe('Enter with queue options', function () {
            it('should not allow queuing locks if overflowStrategy is this', function (done) {
                var lock = new AsyncLock({maxQueueSize: 0, overflowStrategy: 'this'});
                lock.enter(function (token) {
                    lock.enter(function () {
                        done('Should not get here');
                    });
                    expect(lock.queueSize()).to.be.equal(0);
                    token.leave();
                    done();
                });

            });

            it('should not allow queuing locks if overflowStrategy is first', function (done) {
                var lock = new AsyncLock({maxQueueSize: 1, overflowStrategy: 'first'});
                lock.enter(function (token) {
                    token.leave();
                });
                lock.enter(function (token) {
                    done('This should not be called');
                });
                lock.enter(function (token) {
                    done();
                });
                expect(lock.queueSize()).to.be.equal(1);

            });

            it('should not allow queuing locks if overflowStrategy is last', function (done) {
                var lock = new AsyncLock({maxQueueSize: 1, overflowStrategy: 'last'});
                lock.enter(function (token) {
                    token.leave();
                });
                lock.enter(function (token) {
                    done('This should not be called');
                });
                lock.enter(function (token) {
                    done();
                });

                expect(lock.queueSize()).to.be.equal(1);

            });

            it('should not allow queuing locks if overflowStrategy is this', function (done) {
                var lock = new AsyncLock({maxQueueSize: 1, overflowStrategy: 'this'});
                lock.enter(function (token) {
                    token.leave();
                });
                lock.enter(function (token) {
                    done();
                });
                lock.enter(function (token) {
                    done('This should not be called');
                });

                expect(lock.queueSize()).to.be.equal(1);

            });

        });
    });

    describe('Leave a lock', function () {

        it('should throw if token is null or undefined', function () {
            var lock = new AsyncLock();
            expect(function () {
                lock.leave(null);
            }).to.throw('Token cannot be null or undefined');

            expect(function () {
                lock.leave(undefined);
            }).to.throw('Token cannot be null or undefined');

        });

        it('should throw if leave was called when there was no pending token', function () {
            var lock = new AsyncLock();
            expect(function () {
                lock.leave('');
            }).to.throw('There is no pending token in the lock but received ""');

        });

        it('should throw if leave was called with incorrect token', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                token.id = 11;
                expect(function () {
                    lock.leave(token);
                }).to.throw('Owner token mismatch. Expected 0 but received 11');
                done();
            });

        });

        it('should allow enter after leave was called', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                lock.leave(token);

            });
            lock.enter(function () {
                done();
            });

        });

        it('should allow enter after token.leave was called', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                token.leave();

            });
            lock.enter(function () {
                done();
            });

        });

        it('should allow queuing of several entrants', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                token.leave();

            });
            lock.enter(function (token) {
                token.leave();

            });
            lock.enter(function (token) {
                token.leave();

            });
            lock.enter(function () {
                done();
            });


        });


        it('should execute the next entrant when leave was called', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                setTimeout(function () {
                    lock.leave(token);

                }, 100);
            });
            lock.enter(function () {
                done();
            });

        });

        it('should not execute the next entrant when leave was called if that token was canceled', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                setTimeout(function () {
                    lock.leave(token);
                }, 100);
            });
            var token = lock.enter(function () {
                done('Should not be here');
            });

            token.isCanceled = true;

            setTimeout(done, 300);
        });

        it('should have positive elapsed time when leaving after some time', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                setTimeout(function () {
                    expect(token.elapsed()).to.be.above(0);
                    done();
                }, 100);
            });


        });

        it('should not execute the next entrants when leave was called and abort pending is true', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                setTimeout(function () {
                    lock.leave(token, true);
                    expect(lock.queueSize()).to.be.equal(0);
                    expect(tempToken.isCanceled).to.be.true;
                }, 100);
            });

            var tempToken = lock.enter(function () {
                done('Should not be here');
            });

            lock.enter(function () {
                done('Should not be here 2');
            });

            setTimeout(done, 300);
        });
    });

    describe('Check is locked', function () {
        it('should be unlocked if no one entered the lock', function () {
            var lock = new AsyncLock();
            expect(lock.isLocked()).to.be.false;
        });

        it('should be unlocked if everyone left the lock', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                lock.leave(token);
                expect(lock.isLocked()).to.be.false;
                done();
            });

        });

        it('should be locked someone locked it', function (done) {
            var lock = new AsyncLock();
            lock.enter(function () {
                expect(lock.isLocked()).to.be.true;
                done();
            });

        });
    });

    describe('Get queue size', function () {
        it('should get a queue size of 0 if the lock is unlocked', function () {
            var lock = new AsyncLock();
            expect(lock.queueSize()).to.be.equal(0);
        });

        it('should get a queue size of 0 inside the callback', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                expect(lock.queueSize()).to.be.equal(0);
                done();
            })

        });

        it('should get a queue size of 2 when two callbacks are pending', function (done) {
            var lock = new AsyncLock();
            lock.enter(function (token) {
                expect(lock.queueSize()).to.be.equal(2);
                done();
            })
            lock.enter(function () {
            });
            lock.enter(function () {
            });

        });


    });

    describe('Create with options', function () {
        it('should have options if they were specified', function () {
            var lock = new AsyncLock({
                maxQueueSize: 5,
                overflowStrategy: 'aa'
            });
            expect(lock.options.maxQueueSize).to.be.equal(5);
            expect(lock.options.overflowStrategy).to.be.equal('aa');
        });

        it('should have partial options if they were specified', function () {
            var lock = new AsyncLock({
                maxQueueSize: 5,
            });
            expect(lock.options.maxQueueSize).to.be.equal(5);
            expect(lock.options.overflowStrategy).to.be.equal(AsyncLock.defaultOptions.overflowStrategy);
        });

        it('should have default options if they were not specified', function () {
            var lock = new AsyncLock();
            expect(lock.options.maxQueueSize).to.be.equal(Infinity);
            expect(lock.options.overflowStrategy).to.be.equal(AsyncLock.defaultOptions.overflowStrategy);
        });
    });
});