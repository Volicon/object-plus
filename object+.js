/* Object+ Extensions
 * (c) Vlad Balin & Volicon, 2015
 * ============================================================ */

(function( spec ){
    for( var name in spec ){
        Object[ name ] || Object.defineProperty( Object, name, {
            enumerable   : false,
            configurable : true,
            writable     : true,
            value        : spec[ name ]
        } );
    }
})( {
    // Simple logging control, for easy override in applications
    //----------------------------------------------------------
    loglevel : 2,

    error : function(){
        console.error.apply( console, arguments );
    },

    warning : function(){
        this.loglevel > 0 && console.warning.apply( console, arguments );
    },

    info : function(){
        this.loglevel > 1 && console.info.apply( console, arguments );
    },

    log : function(){
        this.loglevel > 2 && console.log.apply( console, arguments );
    },

    // Object's manipulation methods
    // -------------------------------------------------------------
    // Object.assign polyfill from MDN.
    assign : function( target, firstSource ){
        if( target == null ){
            throw new TypeError( 'Cannot convert first argument to object' );
        }

        var to = Object( target );
        for( var i = 1; i < arguments.length; i++ ){
            var nextSource = arguments[ i ];
            if( nextSource == null ){
                continue;
            }

            var keysArray = Object.keys( Object( nextSource ) );
            for( var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++ ){
                var nextKey = keysArray[ nextIndex ];
                var desc    = Object.getOwnPropertyDescriptor( nextSource, nextKey );
                if( desc !== void 0 && desc.enumerable ){
                    to[ nextKey ] = nextSource[ nextKey ];
                }
            }
        }
        return to;
    },

    defaults : function( dest ){
        for( var i = 1; i < arguments.length; i++ ){
            var options = arguments[ i ];
            Object.transform( dest, options, function( val, name ){
                if( !dest.hasOwnProperty( name ) ){
                    return val;
                }
            } );
        }

        return dest;
    },

    // assign and transform object
    transform : function( dest, source, fun, context ){
        for( var name in source ){
            if( source.hasOwnProperty( name ) ){
                var value = fun.call( context, source[ name ], name );
                value === void 0 || ( dest[ name ] = value );
            }
        }

        return dest;
    },

    // get property descriptor looking through all prototype chain
    getPropertyDescriptor : function( obj, prop ){
        for( var desc; !desc && obj; obj = Object.getPrototypeOf( obj ) ){
            desc = Object.getOwnPropertyDescriptor( obj, prop );
        }

        return desc;
    },

    // Loop unrolled iteration and object constructors
    // --------------------------------------------------------------
    createForEach : function( attrSpecs ){
        var statements = [ 'var v;' ];

        for( var name in attrSpecs ){
            statements.push( '(v=a.' + name + ')' + '===void 0||f(v,"' + name + '");' );
        }

        return new Function( 'a', 'f', statements.join( '' ) );
    },

    createCloneCtor : function ( attrSpecs ){
        var statements = [];

        for( var name in attrSpecs ){
            statements.push( "this." + name + "=x." + name + ";" );
        }

        var CloneCtor = new Function( "x", statements.join( '' ) );
        CloneCtor.prototype = Object.prototype;
        return CloneCtor;
    },

    createTransformCtor : function ( attrSpecs ){
        var statements = [ 'var v;' ];

        for( var name in attrSpecs ){
            statements.push( 'this.' + name + '=(v=a.' + name + ')' + '===void 0?void 0 :f(v,"' + name + '");' );
        }

        var TransformCtor = new Function( "a", 'f', statements.join( '' ) );
        TransformCtor.prototype = Object.prototype;
        return TransformCtor;
    },

    // extend function in the fashion of Backbone, with extended features required by NestedTypes
    // - supports native properties definitions
    // - supports forward declarations
    // - mixins
    // - warn in case if base class method is overriden with value. It's popular mistake when working with Backbone.
    extend : (function(){
        var error = {
            overrideMethodWithValue : function( Ctor, name, value ){
                console.warn( '[Type Warning] Base class method overriden with value in Object.extend({ ' + name +
                              ' : ' + value + ' }); Object =', Ctor.prototype );
            }
        };

        function Class(){
            this.initialize.apply( this, arguments );
        }

        // Backbone-style extend with native properties and late definition support
        function extend( protoProps, staticProps ){
            var Parent = this === Object ? Class : this,
                Child;

            if( typeof protoProps === 'function' ){
                Child      = protoProps;
                protoProps = null;
            }
            else if( protoProps && protoProps.hasOwnProperty( 'constructor' ) ){
                Child = protoProps.constructor;
            }
            else{
                Child = function Constructor(){ return Parent.apply( this, arguments ); };
            }

            Object.defaults( Child, Parent );

            Child.prototype             = Object.create( Parent.prototype );
            Child.prototype.constructor = Child;
            Child.__super__             = Parent.prototype;

            protoProps && Child.define( protoProps, staticProps );

            return Child;
        }

        function _extend( Subclass ){
            Subclass.__super__ = this.prototype;
            Object.defaults( Subclass, this );
        }

        function warnOnError( value, name ){
            var prop = Object.getPropertyDescriptor( this.prototype, name );

            if( prop ){
                var baseIsFunction  = typeof prop.value === 'function',
                    valueIsFunction = typeof value === 'function';

                if( baseIsFunction && !valueIsFunction ){
                    error.overrideMethodWithValue( this, name, prop );
                }
            }

            return value;
        }

        function preparePropSpec( spec, name ){
            var prop = Object.getPropertyDescriptor( this.prototype, name );

            if( prop && typeof prop.value === 'function' ){
                error.overrideMethodWithValue( this, name, prop );
            }

            var prepared = spec instanceof Function ? { get : spec } : spec;

            if( prepared.enumerable === void 0 ){
                prepared.enumerable = true;
            }

            return prepared;
        }

        function attachMixins( protoProps ){
            var mixins = protoProps.mixins,
                merged = {}, properties = {};

            for( var i = mixins.length - 1; i >= 0; i-- ){
                var mixin = mixins[ i ];
                Object.assign( properties, mixin.properties );
                Object.assign( merged, mixin );
            }

            Object.assign( merged, protoProps );
            Object.assign( properties, protoProps.properties );

            merged.properties = properties;
            return merged;
        }

        function createForEachProp( proto ){
            var allProps = {};

            // traverse prototype chain
            for( var p = proto; p; p = Object.getPrototypeOf( p ) ){
                Object.transform( allProps, p.properties, function( spec, name ){
                    if( !allProps[ name ] && spec.enumerable ){
                        return spec;
                    }
                } );
            }

            return Object.createForEach( allProps );
        }

        function define( a_protoProps, a_staticProps ){
            var protoProps = a_protoProps || {};
            staticProps    = a_staticProps || {};

            if( protoProps.mixins ){
                protoProps = attachMixins( protoProps );
            }

            Object.transform( this.prototype, protoProps, warnOnError, this );

            // do not inherit abstract class factory!
            if( !staticProps.create ) staticProps.create = null;
            Object.assign( this, staticProps ); // No override check here

            protoProps && Object.defineProperties( this.prototype,
                Object.transform( {}, protoProps.properties, preparePropSpec, this ) );

            this.prototype.forEachProp = createForEachProp( this.prototype );

            return this;
        }

        extend.attach = function(){
            for( var i = 0; i < arguments.length; i++ ){
                var Ctor = arguments[ i ];

                Ctor.extend = extend;
                Ctor.define = define;
                Ctor._extend = _extend;
                Ctor.prototype.initialize || ( Ctor.prototype.initialize = function(){} );
            }
        };

        extend._extend = _extend;
        extend.attach( Class );
        extend.Class = Class;

        return extend;
    })(),

    // ES6 metaprogramming decorator
    // -------------------------------------------------------------
    // Invoke Object.extend metaprogramming hooks.
    // @Object.define <- works as forward definition
    // @Object.define({ spec }) <- works as normal extend.
    define : ( function(){
        function extend( Class ){
            Object.getPrototypeOf( Class.prototype ).constructor._extend( Class );
        }

        return function( Class ){
            if( typeof Class === 'function' ){
                extend( Class );
            }
            else{
                var spec = Class;
                return function( Class ){
                    extend( Class );
                    Class.define( spec );
                }
            }
        }
    } )()
} );

module.exports = Object.extend.Class;