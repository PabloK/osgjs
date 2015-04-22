define( [
    'osg/Matrix',
], function ( Matrix ) {

    'use strict';


    var CacheUniformApply = function ( state, program ) {
        this._program = program;

        this.modelViewUniform = program._uniformsCache[ state.modelViewMatrix.name ];
        this.modelWorldUniform = program._uniformsCache[ state.modelWorldMatrix.name ];
        this.viewUniform = program._uniformsCache[ state.viewMatrix.name ];
        this.projectionUniform = program._uniformsCache[ state.projectionMatrix.name ];
        this.normalUniform = program._uniformsCache[ state.normalMatrix.name ];

        this.apply = undefined;
        this.tempMatrix = Matrix.create();
        this.Matrix = Matrix;
        this.generateUniformsApplyMethods();
    };

    CacheUniformApply.prototype = {


        generateUniformsApplyMethods: function () {

            var functionStr = [ '//generated by RenderLeaf\n' ];
            functionStr.push( 'var gl = state.getGraphicContext();' );
            functionStr.push( 'var matrixModelViewChanged = state.applyModelViewMatrix( modelview );' );
            functionStr.push( 'state.applyProjectionMatrix( projection );' );

            if ( this.modelWorldUniform !== undefined ) {
                functionStr.push( 'if ( matrixModelViewChanged ) {' );
                functionStr.push( '    var modelWorldMatrix = state.modelWorldMatrix;' );
                functionStr.push( '    this.Matrix.copy(modelworld, modelWorldMatrix.get() );' );
                functionStr.push( '    modelWorldMatrix.dirty();' );
                functionStr.push( '    modelWorldMatrix.apply( gl, this.modelWorldUniform);' );
                functionStr.push( '};' );
            }

            if ( this.viewUniform !== undefined ) {
                functionStr.push( 'if ( matrixModelViewChanged ) {' );
                functionStr.push( '    var viewMatrix = state.viewMatrix;' );
                functionStr.push( '    this.Matrix.copy(view, viewMatrix.get() );' );
                functionStr.push( '    viewMatrix.dirty();' );
                functionStr.push( '    viewMatrix.apply( gl, this.viewUniform);' );
                functionStr.push( '};' );
            }

            // I am the evil, so please bother someone else
            /*jshint evil: true */
            var func = new Function( 'state', 'modelview', 'modelworld', 'view', 'projection', functionStr.join( '\n' ) );
            /*jshint evil: false */

            this.apply = func;
        },

        generateUniformsApplyMethodsOld: function () {

            var functionStr = [ '//generated by RenderLeaf\n' ];
            functionStr.push( 'var gl = state.getGraphicContext();' );

            if ( this.modelViewUniform !== undefined ) {
                functionStr.push( 'var modelViewMatrix = state.modelViewMatrix;' );
                functionStr.push( 'this.Matrix.copy(modelview, modelViewMatrix.get() );' );
                functionStr.push( 'modelViewMatrix.dirty();' );
                functionStr.push( 'modelViewMatrix.apply( gl, this.modelViewUniform);' );

                functionStr.push( 'state.applyModelViewMatrix( modelview );' );
            }

            if ( this.modelWorldUniform !== undefined ) {
                functionStr.push( 'var modelWorldMatrix = state.modelWorldMatrix;' );
                functionStr.push( 'this.Matrix.copy(modelworld, modelWorldMatrix.get() );' );
                functionStr.push( 'modelWorldMatrix.dirty();' );
                functionStr.push( 'modelWorldMatrix.apply( gl, this.modelWorldUniform);' );
            }

            if ( this.viewUniform !== undefined ) {
                functionStr.push( 'var viewMatrix = state.viewMatrix;' );
                functionStr.push( 'this.Matrix.copy(view, viewMatrix.get() );' );
                functionStr.push( 'viewMatrix.dirty();' );
                functionStr.push( 'viewMatrix.apply( gl, this.viewUniform);' );
            }

            if ( this.projectionUniform !== undefined ) {
                functionStr.push( 'var projectionMatrix = state.projectionMatrix;' );
                functionStr.push( 'this.Matrix.copy(projection, projectionMatrix.get() );' );
                functionStr.push( 'projectionMatrix.dirty();' );
                functionStr.push( 'projectionMatrix.apply( gl, this.projectionUniform);' );
            }

            if ( this.normalUniform !== undefined ) {
                functionStr.push( 'var normalMatrix = state.normalMatrix;' );
                functionStr.push( 'this.Matrix.copy( modelview, this.tempMatrix );' );
                functionStr.push( 'var normal = this.tempMatrix;' );
                functionStr.push( 'normal[ 12 ] = 0.0;' );
                functionStr.push( 'normal[ 13 ] = 0.0;' );
                functionStr.push( 'normal[ 14 ] = 0.0;' );

                functionStr.push( 'this.Matrix.inverse( normal, normal );' );
                functionStr.push( 'this.Matrix.transpose( normal, normal);' );

                functionStr.push( 'this.Matrix.copy(normal, normalMatrix.get() );' );
                functionStr.push( 'normalMatrix.dirty();' );
                functionStr.push( 'normalMatrix.apply( gl, this.normalUniform);' );
            }

            // I am the evil, so please bother someone else
            /*jshint evil: true */
            var func = new Function( 'state', 'modelview', 'modelworld', 'view', 'projection', 'normal', functionStr.join( '\n' ) );
            /*jshint evil: false */

            this.apply = func;
        }

    };


    var RenderLeaf = function () {

        this._parent = undefined;
        this._geometry = undefined;
        this._depth = 0.0;

        this._projection = undefined;
        this._view = undefined;
        this._modelWorld = undefined;
        this._modelView = undefined;
    };

    RenderLeaf.prototype = {

        reset: function () {
            this._parent = undefined;
            this._geometry = undefined;
            this._depth = 0.0;

            this._projection = undefined;
            this._view = undefined;
            this._modelWorld = undefined;
            this._modelView = undefined;
        },

        init: function ( parent, geom, projection, view, modelView, modelWorld, depth ) {

            this._parent = parent;
            this._geometry = geom;
            this._depth = depth;

            this._projection = projection;
            this._view = view;
            this._modelWorld = modelWorld;
            this._modelView = modelView;

        },

        drawGeometry: ( function () {

            return function ( state ) {


                var program = state.getLastProgramApplied();
                var programInstanceID = program.getInstanceID();
                var cache = state.getCacheUniformsApplyRenderLeaf();
                var obj = cache[ programInstanceID ];

                if ( !obj ) {
                    obj = new CacheUniformApply( state, program );
                    cache[ programInstanceID ] = obj;
                }

                obj.apply( state, this._modelView, this._modelWorld, this._view, this._projection, this._normal );

                this._geometry.drawImplementation( state );

            };
        } )(),

        render: ( function () {
            var previousHash;

            return function ( state, previousLeaf ) {

                var prevRenderGraph;
                var prevRenderGraphParent;
                var rg;

                if ( previousLeaf !== undefined ) {

                    // apply state if required.
                    prevRenderGraph = previousLeaf._parent;
                    prevRenderGraphParent = prevRenderGraph.parent;
                    rg = this._parent;

                    if ( prevRenderGraphParent !== rg.parent ) {

                        rg.moveStateGraph( state, prevRenderGraphParent, rg.parent );

                        // send state changes and matrix changes to OpenGL.

                        state.applyStateSet( rg.stateset );
                        previousHash = state.getStateSetStackHash();

                    } else if ( rg !== prevRenderGraph ) {

                        // send state changes and matrix changes to OpenGL.
                        state.applyStateSet( rg.stateset );
                        previousHash = state.getStateSetStackHash();

                    } else {

                        // in osg we call apply but actually we dont need
                        // except if the stateSetStack changed.
                        // for example if insert/remove StateSet has been used
                        var hash = state.getStateSetStackHash();
                        if ( previousHash !== hash ) {
                            this._parent.moveStateGraph( state, undefined, this._parent.parent );
                            state.applyStateSet( this._parent.stateset );
                            previousHash = hash;
                        }
                    }

                } else {

                    this._parent.moveStateGraph( state, undefined, this._parent.parent );
                    state.applyStateSet( this._parent.stateset );
                    previousHash = state.getStateSetStackHash();

                }

                this.drawGeometry( state );

            };
        } )()

    };

    return RenderLeaf;

} );
