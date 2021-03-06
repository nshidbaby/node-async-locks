describe('Reset Event', function () {

    var ResetEvent = require('./../lib/reset-event');
    var expect = require('chai').expect;

    describe('Helper functions', function () {
        it('should create tokens with different ids', function () {
            var resetEvent = new ResetEvent();
            var token1 = resetEvent.createToken();
            var token2 = resetEvent.createToken();
            expect(token1.id).not.to.be.equal(token2.id);
        });

        it('should execute a callback synchronously', function (done) {
            var resetEvent = new ResetEvent();
            var callback = function () {
                done();
            };
            var token = resetEvent.createToken(callback);
            resetEvent.executeCallback(token);
        });

        describe('Reduce Queue', function () {
            it('should return an empty list if maxQueueSize is not a number', function () {
                var resetEvent = new ResetEvent();
                var queue = [];
                expect(resetEvent.reduceQueue(queue, { maxQueueSize: 'a' }).length).to.be.equal(0);
                expect(resetEvent.reduceQueue(queue, { maxQueueSize: NaN }).length).to.be.equal(0);
            });

            it('should return an empty list if overflowStrategy is not one of first,last,this', function () {
                var resetEvent = new ResetEvent();
                var queue = ['a', 'b', 'c', 'd'];
                expect(resetEvent.reduceQueue(queue, { maxQueueSize: 1, overflowStrategy: 'moo' }).length).to.be.equal(0);
            });

            it('should return an empty list if maxQueueSize is larger than actual queue size', function () {
                var resetEvent = new ResetEvent();
                var queue = ['a', 'b', 'c', 'd'];
                expect(resetEvent.reduceQueue(queue, { maxQueueSize: 5, overflowStrategy: 'last' }).length).to.be.equal(0);
            });

            it('should reduce the last elements of the queue if overflowStrategy is last', function () {
                var resetEvent = new ResetEvent();
                var queue = ['a', 'b', 'c', 'd'];
                var reducedQueue = resetEvent.reduceQueue(queue, { maxQueueSize: 2, overflowStrategy: 'last' });
                expect(queue.length).to.be.equal(2);
                expect(queue[0]).to.be.equal('a');
                expect(queue[1]).to.be.equal('d');
                expect(reducedQueue.length).to.be.equal(2);
                expect(reducedQueue[0]).to.be.equal('b');
                expect(reducedQueue[1]).to.be.equal('c');

            });

            it('should reduce the first elements of the queue if overflowStrategy is first', function () {
                var resetEvent = new ResetEvent();
                var queue = ['a', 'b', 'c', 'd'];
                var reducedQueue = resetEvent.reduceQueue(queue, { maxQueueSize: 2, overflowStrategy: 'first' });
                expect(queue.length).to.be.equal(2);
                expect(queue[0]).to.be.equal('c');
                expect(queue[1]).to.be.equal('d');
                expect(reducedQueue.length).to.be.equal(2);
                expect(reducedQueue[0]).to.be.equal('a');
                expect(reducedQueue[1]).to.be.equal('b');
            });

            it('should reduce only the last element of the queue if overflowStrategy is this', function () {
                var resetEvent = new ResetEvent();
                var queue = ['a', 'b', 'c', 'd'];
                var reducedQueue = resetEvent.reduceQueue(queue, { maxQueueSize: 2, overflowStrategy: 'this' });
                expect(queue.length).to.be.equal(3);
                expect(queue[0]).to.be.equal('a');
                expect(queue[1]).to.be.equal('b');
                expect(queue[2]).to.be.equal('c');
                expect(reducedQueue.length).to.be.equal(1);
                expect(reducedQueue[0]).to.be.equal('d');
            });

        });

    });

    describe('Create with options', function () {
        it('should create the reset event with appropriate signaled state', function () {
            var resetEvent = new ResetEvent(true);
            expect(resetEvent.isSignaled).to.be.true;
            resetEvent = new ResetEvent(false);
            expect(resetEvent.isSignaled).to.be.false;
            resetEvent = new ResetEvent();
            expect(resetEvent.isSignaled).to.be.false;
        });

        it('should create the reset event with appropriate options', function () {
            var resetEvent = new ResetEvent(true);
            expect(resetEvent.options.maxQueueSize).to.be.equal(ResetEvent.defaultOptions.maxQueueSize);
            expect(resetEvent.options.overflowStrategy).to.be.equal(ResetEvent.defaultOptions.overflowStrategy);
            expect(resetEvent.options.autoResetCount).to.be.equal(ResetEvent.defaultOptions.autoResetCount);

            var resetEvent = new ResetEvent(true, { maxQueueSize: 10, overflowStrategy: 'monkey', autoResetCount: 15 });
            expect(resetEvent.options.maxQueueSize).to.be.equal(10);
            expect(resetEvent.options.overflowStrategy).to.be.equal('monkey');
            expect(resetEvent.options.autoResetCount).to.be.equal(15);

            var resetEvent = new ResetEvent(true, { autoResetCount: 15 });
            expect(resetEvent.options.maxQueueSize).to.be.equal(ResetEvent.defaultOptions.maxQueueSize);
            expect(resetEvent.options.overflowStrategy).to.be.equal(ResetEvent.defaultOptions.overflowStrategy);
            expect(resetEvent.options.autoResetCount).to.be.equal(15);

        });

    });

    describe('Reset', function () {
        it('should trow if reset was called on a non signaled event', function () {
            var resetEvent = new ResetEvent(false);
            expect(function () {
                resetEvent.reset();
            }).to.throw('The reset event is already in a non signaled state');
        });

        it('should make the reset event non signaled', function () {
            var resetEvent = new ResetEvent(true);
            resetEvent.reset();
            expect(resetEvent.isSignaled).to.be.false;
        });
    });

    describe('Set', function () {
        it('should trow if reset was called on a signaled event', function () {
            var resetEvent = new ResetEvent(true);
            expect(function () {
                resetEvent.set();
            }).to.throw('The reset event is already in a signaled state');
        });

        it('should make the reset event signaled', function () {
            var resetEvent = new ResetEvent(false);
            resetEvent.set();
            expect(resetEvent.isSignaled).to.be.true;
        });

        it('should execute all the waiting callbacks', function () {
            var resetEvent = new ResetEvent(false);
            var count = 0;

            resetEvent.wait(function () {
                count++;
            });

            resetEvent.wait(function () {
                count++;
            });
            expect(count).to.be.equal(0);
            resetEvent.set();
            expect(count).to.be.equal(2);
        });

        it('should not execute canceled callbacks', function () {
            var resetEvent = new ResetEvent(false);
            var count = 0;

            resetEvent.wait(function () {
                count++;
            });

            resetEvent.wait(function () {
                count++;
            }).isCanceled = true;
            expect(count).to.be.equal(0);
            resetEvent.set();
            expect(count).to.be.equal(1);
        });

        it('should not execute timeout callbacks', function (done) {
            var resetEvent = new ResetEvent(false);
            var count = 0;

            resetEvent.wait(function () {
                count++;
            }, 10);

            resetEvent.wait(function () {
                count++;
            });
            expect(count).to.be.equal(0);
            setTimeout(function () {
                resetEvent.set();
                expect(count).to.be.equal(1);
                done();
            }, 100);
        });


    });

    describe('Wait', function () {
        it('should throw if callback is not a function', function () {
            var resetEvent = new ResetEvent();
            expect(function () {
                resetEvent.wait();
            }).to.throw('Callback must be a function');

            expect(function () {
                resetEvent.wait(10);
            }).to.throw('Callback must be a function');

        });


        it('should throw if create token returns undefined', function () {
            var resetEvent = new ResetEvent();
            resetEvent.createToken = function () { };
            expect(function () {
                resetEvent.wait(function () { });
            }).to.throw('Token cannot be null or undefined');
        });

        it('should return a token with timeoutId if timeout was provided', function () {
            var resetEvent = new ResetEvent();
            var token = resetEvent.wait(function () { }, 100);
            expect(token).to.be.ok;
            expect(token.timeoutId).to.be.ok;
        });

        it('should execute immediately if the event is signaled', function (done) {
            var resetEvent = new ResetEvent(true);
            resetEvent.wait(function () {
                done();
            });
        });

        it('should not execute immediately if the event is not signaled', function (done) {
            var resetEvent = new ResetEvent(false);
            resetEvent.wait(function () {
                done('should not get here');
            });

            expect(resetEvent.queueSize()).to.be.equal(1);
            done();
        });

        describe('Wait with queue options', function () {
            it('should not allow queuing if overflowStrategy is this', function (done) {
                var resetEvent = new ResetEvent(false, { maxQueueSize: 1, overflowStrategy: 'this' });

                resetEvent.wait(function () {
                    done();
                });

                resetEvent.wait(function () {
                    done('Should not be here');
                });

                expect(resetEvent.queueSize()).to.be.equal(1);
                resetEvent.set();
            });

            it('should not allow queuing if overflowStrategy is first', function (done) {
                var resetEvent = new ResetEvent(false, { maxQueueSize: 1, overflowStrategy: 'first' });

                resetEvent.wait(function () {
                    done('Should not be here');
                });

                resetEvent.wait(function () {
                    done();
                });

                expect(resetEvent.queueSize()).to.be.equal(1);
                resetEvent.set();
            });

            it('should not allow queuing if overflowStrategy is last', function (done) {
                var resetEvent = new ResetEvent(false, { maxQueueSize: 2, overflowStrategy: 'last' });

                resetEvent.wait(function () {
                });

                resetEvent.wait(function () {
                    done('Should not be here');
                });

                resetEvent.wait(function () {
                    done();
                });


                expect(resetEvent.queueSize()).to.be.equal(2);
                resetEvent.set();
            });

        });
    });

    describe('Queue size', function () {
        it('should get queue size of an empty event', function () {
            var resetEvent = new ResetEvent();
            expect(resetEvent.queueSize()).to.be.equal(0);
        });

        it('should get queue size of a waited event', function () {
            var resetEvent = new ResetEvent();
            resetEvent.wait(function () { });
            resetEvent.wait(function () { });
            expect(resetEvent.queueSize()).to.be.equal(2);
        });

    });

    describe('Signaled state', function () {
        it('should create the reset event with appropriate signaled state', function () {
            var resetEvent = new ResetEvent(true);
            expect(resetEvent.isSignaled).to.be.true;
            resetEvent = new ResetEvent(false);
            expect(resetEvent.isSignaled).to.be.false;
            resetEvent = new ResetEvent();
            expect(resetEvent.isSignaled).to.be.false;
        });
    });

    describe('Auto reset', function () {
        it('Should auto reset after the specified number of calls', function (done) {
            var resetEvent = new ResetEvent(false, { autoResetCount: 1 });
            resetEvent.wait(function () {

            });

            resetEvent.wait(function () {
                done('This should not be called');
            });

            resetEvent.wait(function () {
                done('This should not be called');
            });

            resetEvent.set();
            done();
        })

        it('Should auto reset after the specified number of calls with canceled', function (done) {
            var resetEvent = new ResetEvent(false, { autoResetCount: 1 });
            resetEvent.wait(function () {
            }).isCanceled = true;

            resetEvent.wait(function () {
                done();
            });

            resetEvent.wait(function () {
                done('This should not be called');
            });

            resetEvent.set();
        });

        it('Should auto reset after the specified number of calls with timeout', function (done) {
            var resetEvent = new ResetEvent(false, { autoResetCount: 1 });
            resetEvent.wait(function () {
                done();
            }, 100);

            resetEvent.wait(function () {
                done('This should not be called');
            });

            resetEvent.wait(function () {
                done('This should not be called');
            });

            resetEvent.set();
        });

        it('Should auto reset after the specified number of calls on wait', function (done) {
            var resetEvent = new ResetEvent(false, { autoResetCount: 1 });
            resetEvent.wait(function () {
            });

            resetEvent.set();

            resetEvent.wait(function () {
                done('This should not be called');
            });

            done();

        });

    });
});