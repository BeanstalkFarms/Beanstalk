/* eslint-disable */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Box, Card, CardProps, Stack, Typography } from '@mui/material';
import { Tooltip, useTooltip } from '@visx/tooltip';
import { Text } from '@visx/text';
import { Circle, Line } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { RectClipPath } from '@visx/clip-path';
import { scaleLinear } from '@visx/scale';
import { localPoint } from '@visx/event';
import { PatternLines } from '@visx/pattern';
import { applyMatrixToPoint, Zoom } from '@visx/zoom';
import { ProvidedZoom, TransformMatrix } from '@visx/zoom/lib/types';
import { voronoi, VoronoiPolygon } from '@visx/voronoi';
import BigNumber from 'bignumber.js';
import { useNavigate } from 'react-router-dom';
import { PodListing, PodOrder } from '~/state/farmer/market';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import EntityIcon from '~/components/Market/PodsV2/Common/EntityIcon';
import { displayBN } from '~/util';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import './MarketGraph.css';
import { useMarketPageUrlParams } from '../utils';

/// //////////////////////////////// TYPES ///////////////////////////////////

type CirclePosition = {
  x: number;
  y: number;
  radius: number;
  id: string;
};

type SelectedPoint = {
  type: 'listing' | 'order';
  index: number; // index in the listings or orders array
  coordinate: CirclePosition
}

export type MarketGraphProps = {
  listings: PodListing[];
  orders: PodOrder[];
  maxPlaceInLine: number;
  maxPlotSize: number;
  harvestableIndex: BigNumber;
}

type GraphProps = {
  width: number;
  height: number;
  params: { listingID?: string, orderID?: string };
} & MarketGraphProps;

/// //////////////////////////////// STYLE & LAYOUT ///////////////////////////////////

const PATTERN_ID = 'brush_pattern';
export const accentColor = '#f6acc8';
export const background = '#584153';
export const background2 = '#af8baf';
const axisColor      = BeanstalkPalette.lightGrey;
const tickLabelColor = BeanstalkPalette.lightGrey;
const tickLabelProps = (type: 'x' | 'y') => () => ({
  fill: tickLabelColor,
  fontSize: 12,
  fontFamily: 'Futura PT',
  textAnchor: (type === 'x' ? 'middle' as const : 'end' as const),
  dy: (type === 'x' ? undefined : 4),
  dx: (type === 'x' ? undefined : -2),
});

const tooltipWidth = 100;
const scaleXMin = 1;
const scaleXMax = 4;
const scaleYMin = 1;
const scaleYMax = 4;

const margin = {
  top: 10,
  left: 0,
  right: 0,
  bottom: 0,
};
const axis = {
  xHeight: 28,
  yWidth:  45,
};
const neighborRadius = 75;

const HOVER_MULTIPLIER = 1.8;
const HOVER_PEER_OPACITY = 0.2;

/// //////////////////////////////// STYLE & LAYOUT ///////////////////////////////////

// Calculates a circle radius between MIN_RADIUS and MAX_RADIUS based on the given plotSize
// Uses log-scale stretching to give relative scale among large maxPlotSize values
const MIN_RADIUS = 2;
const MAX_RADIUS = 6;
const calculateCircleRadius = (
  plotSize: number,
  maxPlotSize: number
): number => {
  const logPlotSize = Math.log(plotSize) > 0 ? Math.log(plotSize) : 0;
  const ratio = logPlotSize / Math.log(maxPlotSize);
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * ratio;
};

// Returns the index of the element within positions that the given point is within.
// Returns undefined if point is not within any position.
const findPointInCircles = (
  positions: CirclePosition[],
  point: { x: number; y: number }
): number | undefined => {
  const foundPositions: number[] = [];
  for (let i = 0; i < positions.length; i += 1) {
    const position = positions[i];
    if (
      point.x >= position.x - position.radius &&
      point.x <= position.x + position.radius &&
      point.y >= position.y - position.radius &&
      point.y <= position.y + position.radius
    ) {
      foundPositions.push(i);
    }
  }

  // In case point is within multiple positions, choose the one with the smallest radius
  const minRadius = Math.min(
    ...foundPositions.map((index) => positions[index].radius)
  );
  return foundPositions.find((index) => positions[index].radius === minRadius);
};

/// //////////////////////////////// SCALING ///////////////////////////////////

const rescaleYWithZoom = (scale: any, zoom: any) => {
  const newDomain = scale.range().map((r: any) => scale.invert(
    (r - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY
  ));
  return scale.copy().domain(newDomain);
};

const rescaleXWithZoom = (scale: any, zoom: any) => {
  const newDomain = scale.range().map((r: any) => scale.invert(
    (r - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX
  ));
  return scale.copy().domain(newDomain);
};

/// //////////////////////////////// COMPONENTS ///////////////////////////////////

const TooltipCard : FC<CardProps> = ({ children, sx, ...props }) => (
  <Card sx={{ backgroundColor: BeanstalkPalette.lightestBlue, px: 0.5, py: 0.5, ...sx }} {...props}>
    {children}
  </Card>
);

/// //////////////////////////////// GRAPH ///////////////////////////////////

/**
 * @TODO
 * - Voronoi is extremely slow because of cascading rerenders with zooming
 * - The selected point should be displayed on top of other points, since SVG
 *   doesn't support z-index this has to be done by moving it to the top of
 *   the element stack, which breaks the indexing pattern. Check out svg#use.
 * - If loading page directly to a listing/order, the cursor position lines are
 *   not drawn correctly of the zoom position isn't known.
 */
const Graph: FC<GraphProps> = ({
  height,
  width,
  listings,
  orders,
  maxPlaceInLine,
  maxPlotSize,
  params
}) => {
  /// Sizing
  const innerWidth  = width -  (margin.left + margin.right);
  const innerHeight = height - (margin.top  + margin.bottom);
  const svgRef = useRef<SVGRectElement>(null);
  
  /// Tooltip
  const {
    tooltipOpen,
    tooltipTop,
    tooltipLeft,
    hideTooltip,
    showTooltip,
    tooltipData: hoveredPoint,
  } = useTooltip<SelectedPoint>();

  /// Scales
  const xScale = scaleLinear<number>({
    domain: [
      0,
      Math.max(maxPlaceInLine * 1.1)
    ],
    range: [
      0,                          //
      innerWidth - axis.yWidth    //
    ],
  });
  const yScale = scaleLinear<number>({
    domain: [
      0,
      1
    ],
    range: [
      height - axis.xHeight,      //
      margin.top                  //
    ],
  });

  /// Position data
  const orderPositions : CirclePosition[] = useMemo(() => 
    orders.map((order) => ({
      id: order.id,
      // x position is current place in line
      x: xScale(new BigNumber(order.maxPlaceInLine).toNumber()) + axis.yWidth,
      // y position is price per pod
      y: yScale(order.pricePerPod.toNumber()),
      // radius is plot size
      radius: 4,
    })),
    [orders, xScale, yScale]
  );
  const listingPositions : CirclePosition[] = useMemo(() => 
    listings.map((listing) => ({
      id: listing.id,
      // x position is current place in line
      x: xScale(listing.placeInLine.toNumber()) + axis.yWidth,
      // y position is price per pod
      y: yScale(listing.pricePerPod.toNumber()),
      // radius is plot size
      radius: calculateCircleRadius(
        listing.remainingAmount.toNumber(),
        maxPlotSize
      ),
    })),
    [listings, maxPlotSize, xScale, yScale]
  );

  /// Voronoi
  const combinedPositions : CirclePosition[] = useMemo(() => 
    [...listingPositions, ...orderPositions],
    [listingPositions, orderPositions]
  );
  const voronoiLayout = useMemo(
    () =>
      voronoi<CirclePosition>({
        x: (d) => d.x,
        y: (d) => d.y,
        width: innerWidth,
        height: innerHeight,
      })(combinedPositions),
    [innerWidth, innerHeight, combinedPositions],
  );
  const polygons = voronoiLayout.polygons();
  const [voroHoveredId, setVoronoiHoveredId] = useState<string | null>(null);
  const [voroNeighborIds, setVoronoiNeighborIds] = useState<Set<string>>(new Set());

  /// Selected point
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | undefined>(undefined);
  const cursorPoint = useMemo(() => selectedPoint || hoveredPoint, [selectedPoint, hoveredPoint]);

  const navigate = useNavigate();
  
  /// Helpers
  const peerOpacity = useCallback((_type: SelectedPoint['type'], _i: number) => (
    !cursorPoint?.type 
      ? 1 
      : cursorPoint.type === _type
        ? (cursorPoint.index === _i ? 1 : HOVER_PEER_OPACITY)
        : HOVER_PEER_OPACITY
  ), [cursorPoint]);

  /// Elements
  const orderCircles = useMemo(() => orderPositions.map((coordinate, i) => {
    const active = cursorPoint?.type === 'order' && i === cursorPoint?.index;
    return (
      <Circle
        key={`order-${i}`}
        cx={coordinate.x}
        cy={coordinate.y}
        r={active ? HOVER_MULTIPLIER * coordinate.radius : coordinate.radius}
        opacity={peerOpacity('order', i)}
        fill={BeanstalkPalette.logoGreen}
        stroke={active ? BeanstalkPalette.mediumGreen : '#fff'}
        strokeWidth={active ? 2 : 1}
        cursor="pointer"
        className={`mg-point mg-point-o${active ? ' mg-active' : ''}`}
      />
    );
  }), [cursorPoint?.index, cursorPoint?.type, orderPositions, peerOpacity]);
  const listingCircles = useMemo(() => listingPositions.map((coordinate, i) => {
    const active = cursorPoint?.type === 'listing' && i === cursorPoint?.index;
    return (
      <Circle
        key={`listing-${i}`}
        cx={coordinate.x}
        cy={coordinate.y}
        r={active ? HOVER_MULTIPLIER * coordinate.radius : coordinate.radius}
        opacity={peerOpacity('listing', i)}
        fill={BeanstalkPalette.mediumRed}
        stroke={active ? BeanstalkPalette.trueRed : '#fff'}
        strokeWidth={active ? 2 : 1}
        cursor="pointer"
        className={`mg-point mg-point-l${active ? ' mg-active' : ''}`}
      />
    );
  }), [cursorPoint?.index, cursorPoint?.type, listingPositions, peerOpacity]);
  const voroniPolygons = (
    <g>
      {polygons.map((polygon) => (
        <VoronoiPolygon
          key={`polygon-${polygon.data.id}`}
          polygon={polygon}
          fill={
            voroHoveredId && (polygon.data.id === voroHoveredId || voroNeighborIds.has(polygon.data.id))
              ? 'red'
              : 'transparent'
          }
          fillOpacity={voroHoveredId && voroNeighborIds.has(polygon.data.id) ? 0.05 : 0.2}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );

  const cursorPositionLines = cursorPoint
    ? cursorPoint?.type === 'listing'
      ? (
        <g>
          <Line
            from={{ x: 0, y: cursorPoint.coordinate.y }}
            to={{   x: cursorPoint.coordinate.x, y: cursorPoint.coordinate.y }}
            stroke={BeanstalkPalette.lightGrey}
            strokeWidth={1}
            pointerEvents="none"
          />
          <Line
            from={{ x: cursorPoint.coordinate.x, y: innerHeight }}
            to={{   x: cursorPoint.coordinate.x, y: cursorPoint.coordinate.y }}
            stroke={BeanstalkPalette.lightGrey}
            strokeWidth={1}
            pointerEvents="none"
          />
          <Text fill={BeanstalkPalette.textBlue} x={cursorPoint.coordinate.x + 10} y={innerHeight - axis.xHeight} fontSize={14}>
            {displayBN(listings[cursorPoint.index].placeInLine)}
          </Text>
          <Text fill={BeanstalkPalette.textBlue} x={axis.yWidth + 10} y={cursorPoint.coordinate.y - 5} fontSize={14}>
            {listings[cursorPoint.index].pricePerPod.toFixed(4)}
          </Text>
        </g>
      )
      : (
        <g>
          <Line
            from={{ x: 0, y: cursorPoint.coordinate.y }}
            to={{   x: cursorPoint.coordinate.x, y: cursorPoint.coordinate.y }}
            stroke={BeanstalkPalette.lightGrey}
            strokeWidth={1}
            pointerEvents="none"
          />
          <Line
            from={{ x: cursorPoint.coordinate.x, y: innerHeight }}
            to={{   x: cursorPoint.coordinate.x, y: cursorPoint.coordinate.y }}
            stroke={BeanstalkPalette.lightGrey}
            strokeWidth={1}
            pointerEvents="none"
          />
          <rect
            fill={`url(#${PATTERN_ID})`}
            x={0}
            y={cursorPoint.coordinate.y}
            height={innerHeight - cursorPoint.coordinate.y}
            width={cursorPoint.coordinate.x}
          />
          <Text fill={BeanstalkPalette.textBlue}x={cursorPoint.coordinate.x + 10} y={innerHeight - axis.xHeight} fontSize={14}>
            {displayBN(orders[cursorPoint.index].maxPlaceInLine)}
          </Text>
          <Text fill={BeanstalkPalette.textBlue} x={axis.yWidth + 10} y={cursorPoint.coordinate.y - 5} fontSize={14}>
            {orders[cursorPoint.index].pricePerPod.toFixed(4)}
          </Text>
        </g>
      )
    : null;

  /// Handlers
  const handleMouseMove = useCallback((event: React.MouseEvent | React.TouchEvent, zoom: ProvidedZoom<SVGSVGElement>) => {
    if (!svgRef.current) return;  //
    if (selectedPoint) return;    // skip mouse interaction if a point is selected

    // This is the mouse position with respect to the 
    // svg element, which doesn't change size.
    const point = localPoint(svgRef.current, event);
    if (!point) return;

    // We use the current zoom to transform the current mouse coordinates
    // into their "actual" position based on the zoom settings. For example,
    // when zoomed all the way out the top left corner of the graph is (0, 0),
    // but at higher zoom levels it will be some other non-zero value. This ensures
    // that we can hover over circles correctly even when zoomed in.
    const transformedPoint = zoom.applyInverseToPoint(point);

    // Voronoi
    const closest = voronoiLayout.find(transformedPoint.x, transformedPoint.y, neighborRadius);

    // find neighboring polygons to hightlight
    if (closest && closest.data.id !== voroHoveredId) {
      const neighbors = new Set<string>();
      const cell = voronoiLayout.cells[closest.index];
      if (!cell) return;

      cell.halfedges.forEach((index) => {
        const edge = voronoiLayout.edges[index];
        const { left, right } = edge;
        if (left && left !== closest) neighbors.add(left.data.id);
        else if (right && right !== closest) neighbors.add(right.data.id);
      });

      setVoronoiNeighborIds(neighbors);
      setVoronoiHoveredId(closest.data.id);
    }

    // Check if we're hovering a Listing
    const listingIndex = findPointInCircles(listingPositions, transformedPoint);
    if (listingIndex !== undefined) {
      // Get the original position of the circle (no zoom)
      // FIXME: rename this position? used word interchangably.
      // position makes more sense for the line.
      const coordinate = listingPositions[listingIndex];

      // Apply our current zoom settings to the original position.
      // This makes sure the tooltip appears in the right spot even
      // if you zoom/pan around.
      const zoomedCoordinate = zoom.applyToPoint(coordinate);

      // Show tooltip at top-right corner of circle position.
      // Nudge inward to make hovering easier.
      return showTooltip({
        tooltipLeft: zoomedCoordinate.x,
        tooltipTop:  zoomedCoordinate.y,
        tooltipData: {
          index: listingIndex,
          type: 'listing',
          coordinate: coordinate
        }
      });
    }

    // Check if we're hovering an Order
    const orderIndex = findPointInCircles(orderPositions, transformedPoint);
    if (orderIndex !== undefined) {
      // Get the original position of the circle (no zoom)
      const coordinate = orderPositions[orderIndex];

      const zoomedCoordinate = zoom.applyToPoint({
        x: coordinate.x,
        y: coordinate.y,
      });

      // Show tooltip at bottom-right corner of circle position.
      // Nudge inward to make hovering easier.
      return showTooltip({
        tooltipLeft:  zoomedCoordinate.x,
        tooltipTop:   zoomedCoordinate.y,
        tooltipData: {
          index: orderIndex,
          type: 'order',
          coordinate: coordinate
        }
      });
    }

    return hideTooltip();
  }, [hideTooltip, listingPositions, orderPositions, selectedPoint, showTooltip]);

  // Reset: remove selected point and hide tooltip.
  const reset = useCallback(() => {
    setSelectedPoint(undefined);
    hideTooltip();
    navigate('/market/buy');
  }, [hideTooltip, navigate]);

  const handleClick = useCallback(() => { 
    // Clicking with a point selected returns back to the market index
    if (selectedPoint) {
      reset();
    } 
    
    // If we're hovering a point, select it
    else if (hoveredPoint) {
      setSelectedPoint(hoveredPoint);
      if (hoveredPoint.type === 'listing') {
        // handleClickFill(PodOrderAction.BUY, PodOrderType.FILL);
        navigate(`/market/buy/${listings[hoveredPoint.index].id}`);
      } else if (hoveredPoint.type === 'order') {
        // handleClickFill(PodOrderAction.SELL, PodOrderType.FILL);
        navigate(`/market/sell/${orders[hoveredPoint.index].id}`);
      }
    }
  }, [selectedPoint, hoveredPoint, reset, navigate, listings, orders]);

  useEffect(() => {
    // both are undefined
    if (!params.listingID && !params.orderID) {
      if (selectedPoint) {
        setSelectedPoint(undefined);
        hideTooltip();
      }
    } else if (params.listingID) {
      const index = listings.findIndex((l) => l.id === params.listingID);
      if (!selectedPoint || selectedPoint.index !== index) {
        setSelectedPoint({
          type: 'listing',
          index,
          coordinate: listingPositions[index]
        });
      }
    } else if (params.orderID) {
      const index = orders.findIndex((l) => l.id === params.orderID);
      if (!selectedPoint || selectedPoint.index !== index) {
        setSelectedPoint({
          type: 'order',
          index,
          coordinate: orderPositions[index],
        });
      }
    }
  }, [hideTooltip, listingPositions, listings, orderPositions, orders, params, selectedPoint]);

  /// Hotkeys
  useHotkeys('esc', reset, {}, [reset]);
  
  // This works to constrain at x=0 y=0 but it causes some weird
  // mouse and zoom behavior.
  // https://airbnb.io/visx/docs/zoom#Zoom_constrain
  const constrain = useCallback((
    transformMatrix: TransformMatrix,
    prevTransformMatrix: TransformMatrix
  ) => {
    // // Fix scaling
    // const { scaleX, scaleY, translateX, translateY } = transformMatrix;
    // if (scaleX < scaleXMin || scaleX > scaleXMax) return prevTransformMatrix;
    // if (scaleY < scaleYMin || scaleY > scaleYMax) return prevTransformMatrix;

    // // Fix translate
    // const min = applyMatrixToPoint(transformMatrix, { x: 0, y: 0 });
    // const max = applyMatrixToPoint(transformMatrix, { x: width, y: height });
    // if (max.x < width || max.y < height) {
    //   return prevTransformMatrix;
    // }
    // if (min.x > 0 || min.y > 0) {
    //   return prevTransformMatrix;
    // }
    // return transformMatrix;

    if (selectedPoint) return prevTransformMatrix;

    const { scaleX, scaleY, translateX, translateY } = transformMatrix;
    // Fix constrain scale
    // if (scaleX < 1) transformMatrix.scaleX = 1;
    // if (scaleY < 1) transformMatrix.scaleY = 1;
    if (scaleX < scaleXMin) transformMatrix.scaleX = scaleXMin;
    else if (scaleX > scaleXMax) transformMatrix.scaleX = scaleXMax;
    if (scaleY < scaleYMin) transformMatrix.scaleY = scaleYMin;
    else if (scaleY > scaleYMax) transformMatrix.scaleY = scaleYMax;

    // Fix constrain translate [left, top] position
    if (translateX > 0) transformMatrix.translateX = 0;
    if (translateY > 0) transformMatrix.translateY = 0;
    // Fix constrain translate [right, bottom] position
    const max = applyMatrixToPoint(transformMatrix, {
      x: width,
      y: height
    });
    if (max.x < width) {
      transformMatrix.translateX = translateX + Math.abs(max.x - width);
    }
    if (max.y < height) {
      transformMatrix.translateY = translateY + Math.abs(max.y - height);
    }

    // Return the matrix
    return transformMatrix;
  }, [height, width, selectedPoint]);

  const onMouseMove = useCallback((zoom: ProvidedZoom<SVGSVGElement> & any) => 
    (evt: React.MouseEvent | React.TouchEvent) => {
      zoom.dragMove(evt); // handle zoom drag
      handleMouseMove(evt, zoom); // handle hover event for tooltips
    },
  [handleMouseMove]);
  const onMouseLeave = useCallback((zoom: ProvidedZoom<SVGSVGElement> & any) => 
    () => {
      if (zoom.isDragging) zoom.dragEnd();
    },
  []);

  return (
    <Zoom<SVGSVGElement>
      width={width}
      height={height}
      constrain={constrain}
      scaleXMin={scaleXMin}
      scaleXMax={scaleXMax}
      scaleYMin={scaleYMin}
      scaleYMax={scaleYMax}
    >
      {(zoom) => (
        <Box sx={{ position: 'relative' }}>
          <svg
            width={width}
            height={height}
            ref={zoom.containerRef}
          >
            <RectClipPath
              id="zoom-clip"
              width={width - axis.yWidth}
              height={height - axis.xHeight}
              x={axis.yWidth}
              y={0}
            />
            <PatternLines
              id={PATTERN_ID}
              height={5}
              width={5}
              stroke={BeanstalkPalette.logoGreen}
              strokeWidth={1}
              orientation={['diagonal']}
            />
            <g clipPath="url(#zoom-clip)">
              <g transform={zoom.toString()}>
                {voroniPolygons}
                {cursorPositionLines}
                {orderCircles}
                {listingCircles}
              </g>
            </g>
            <rect
              width={width - axis.yWidth}
              height={height - axis.xHeight}
              x={axis.yWidth}
              y={0}
              fill="transparent"
              ref={svgRef}
              onTouchStart={zoom.dragStart}
              onTouchMove={zoom.dragMove}
              onTouchEnd={zoom.dragEnd}
              onMouseDown={zoom.dragStart}
              onClick={handleClick}
              onMouseMove={onMouseMove(zoom)}
              onMouseUp={zoom.dragEnd}
              onMouseLeave={onMouseLeave(zoom)}
              css={{
                cursor: (
                  selectedPoint
                    ? 'default'         // when selected, freeze cursor
                    : hoveredPoint      // hovering over a point but haven't clicked it yet
                      ? 'pointer'      
                      : zoom.isDragging
                        ? 'grabbing'    // if dragging, show grab
                        : 'default'        // not hovering a point, user can drag
                ),
                touchAction: 'none',
              }}
            />
            <AxisLeft<typeof yScale>
              scale={rescaleYWithZoom(yScale, zoom)}
              left={axis.yWidth}
              numTicks={10}
              stroke={axisColor}
              tickLabelProps={tickLabelProps('y')}
              tickStroke={axisColor}
              tickFormat={(d) => d.valueOf().toFixed(2)}
              hideZero
            />
            {/* X axis: Place in Line */}
            <AxisBottom<typeof xScale>
              scale={rescaleXWithZoom(xScale, zoom)}
              top={height - axis.xHeight}
              left={axis.yWidth}
              numTicks={10}
              stroke={axisColor}
              tickLabelProps={tickLabelProps('x')}
              tickStroke={axisColor}
              tickFormat={(_d) => {
                const d = _d.valueOf();
                if (d < 1e6) return `${d / 1e3}k`;
                return `${d / 1e6}M`;
              }}
              hideZero
            />
          </svg>
          {/**
            * Show a tooltip with the number of Pods whenever a point is
            * hovered over or selected.
            */}
          {tooltipOpen &&
            cursorPoint &&
            tooltipLeft != null &&
            tooltipTop != null &&
            (
              <Tooltip
                offsetLeft={10}
                offsetTop={-40}
                left={tooltipLeft}
                top={tooltipTop}
                width={tooltipWidth}
                applyPositionStyle
                style={{
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                  fontSize: 13,
                }}
              >
                <TooltipCard>
                  <Row gap={0.5}>
                    <EntityIcon type={cursorPoint.type} size={20} />
                    {cursorPoint.type === 'listing'
                      ? displayBN(listings[cursorPoint.index].remainingAmount)
                      : displayBN(orders[cursorPoint.index].podAmountRemaining)
                    } Pods
                  </Row>
                </TooltipCard>
              </Tooltip>
          )}
          {selectedPoint && (
            <Stack sx={{ position: 'absolute', top: 0, right: 10 }}>
              <Typography color="text.tertiary" variant="bodySmall" textAlign="right" sx={{ textTransform: 'capitalize' }}>Viewing: {selectedPoint.type} {selectedPoint.type === 'listing' ? selectedPoint.coordinate.id : selectedPoint.coordinate.id.substring(0, 8)}</Typography>
              <Typography color="text.tertiary" variant="bodySmall" textAlign="right">
                Hit ESC or click anywhere to close
              </Typography>
            </Stack>
          )}
        </Box>
      )}
    </Zoom>
  );
};

const MarketGraph: FC<MarketGraphProps> = (props) => {
  // const params = useParams<GraphProps['params']>();
  const params = useMarketPageUrlParams();

  return (
    <ParentSize debounceTime={100}>
      {({ width, height }) => (
        <Graph
          width={width}
          height={height}
          params={params}
          {...props}
        >
          {props.children}
        </Graph>
      )}
    </ParentSize>
  );
};

export default MarketGraph;

// {selectedPoint && (
//   <SelectedPointPopover
//     selectedPoint={selectedPoint}
//     orders={orders}
//     listings={listings}
//     onClose={() => setSelectedPoint(undefined)}
//   />
// )}

// <Typography display="block" variant="bodySmall" color="gray" textAlign="left" mt={0.25}>
  // Click to view
// </Typography>

// useHotkeys('tab', () => {
//   if (selectedPoint) {
//     if (selectedPoint.type === 'listing') {
//       const point = {
//         index: 0,
//         coordinate: listingPositions[0],
//         type: 'listing' as const
//       };
//       setSelectedPoint(point);
//     }
//   }
// }, {}, [selectedPoint]);

// const handleClickFill = useCallback((action: PodOrderAction, type: PodOrderType) => {
//   if (orderAction !== action) {
//     setOrderAction(action);
//   }
//   setOrderType(type);
// }, [orderAction, setOrderAction, setOrderType]);

// if (orderAction !== PodOrderAction.BUY) {
//   setOrderAction(PodOrderAction.BUY);
// }
// if (orderType !== PodOrderType.ORDER) {
//   setOrderType(PodOrderType.ORDER);
// }

// const [orderAction, setOrderAction] = useAtom(podsOrderActionTypeAtom);
// const [orderType, setOrderType] = useAtom(podsOrderTypeAtom);
