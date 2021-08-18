/*
The MIT License

Copyright © 2010-2021 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

( function () {

	class LineGeometry extends THREE.LineSegmentsGeometry {

		constructor() {

			super();
			this.type = 'LineGeometry';

		}

		setPositions( array ) {

			// converts [ x1, y1, z1,  x2, y2, z2, ... ] to pairs format
			var length = array.length - 3;
			var points = new Float32Array( 2 * length );

			for ( var i = 0; i < length; i += 3 ) {

				points[ 2 * i ] = array[ i ];
				points[ 2 * i + 1 ] = array[ i + 1 ];
				points[ 2 * i + 2 ] = array[ i + 2 ];
				points[ 2 * i + 3 ] = array[ i + 3 ];
				points[ 2 * i + 4 ] = array[ i + 4 ];
				points[ 2 * i + 5 ] = array[ i + 5 ];

			}

			super.setPositions( points );
			return this;

		}

		setColors( array ) {

			// converts [ r1, g1, b1,  r2, g2, b2, ... ] to pairs format
			var length = array.length - 3;
			var colors = new Float32Array( 2 * length );

			for ( var i = 0; i < length; i += 3 ) {

				colors[ 2 * i ] = array[ i ];
				colors[ 2 * i + 1 ] = array[ i + 1 ];
				colors[ 2 * i + 2 ] = array[ i + 2 ];
				colors[ 2 * i + 3 ] = array[ i + 3 ];
				colors[ 2 * i + 4 ] = array[ i + 4 ];
				colors[ 2 * i + 5 ] = array[ i + 5 ];

			}

			super.setColors( colors );
			return this;

		}

		fromLine( line ) {

			var geometry = line.geometry;

			if ( geometry.isGeometry ) {

				console.error( 'THREE.LineGeometry no longer supports Geometry. Use THREE.BufferGeometry instead.' );
				return;

			} else if ( geometry.isBufferGeometry ) {

				this.setPositions( geometry.attributes.position.array ); // assumes non-indexed

			} // set colors, maybe


			return this;

		}

	}

	LineGeometry.prototype.isLineGeometry = true;

	THREE.LineGeometry = LineGeometry;

} )();