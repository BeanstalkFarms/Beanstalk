import argparse
from eth_abi import encode_single
import math
from decimal import Decimal

def main(args):
    if(args.type == "fracExp"):
        fracExp(args.input_1, args.input_2)
    elif(args.type == "morningAuctionLog"):
        morningAuctionLog(args.input_1, args.input_2)
    else:
        raise(Exception("Unknown type"))

def fracExp(beanReward, blocks):
    # cap at 25 blocks
    blocks = blocks if blocks < 25 else 25
    newReward = (beanReward) * pow(1.01, blocks * 12) 
    enc = encode_single('uint256', int(newReward))

    # this print statement must be here for ffi to work
    print("0x" + enc.hex())

def morningAuctionLog(t, blocks): 
    # https://github.com/BeanstalkFarms/Beanstalk/pull/133 
    blocks = blocks if blocks < 25 else 25
    scale = math.floor(math.log((2*blocks) + 1, 51) * 1e12)
    tempScale = t * scale
    tempScale = math.ceil(Decimal(tempScale) / Decimal(1e6))
    new_t = max(tempScale, 1e6)
    
    if t == 0:
        new_t = 0
    if blocks == 0:
        new_t = 1e6
    if blocks == 25:
        new_t = 1e6 * t 
    enc = encode_single('uint256', int(new_t))
    
    # this print statement must be here for ffi to work
    print("0x" + enc.hex())

def parse_args(): 
    parser = argparse.ArgumentParser()
    parser.add_argument("type", choices=["fracExp", "morningAuctionLog"])
    parser.add_argument("--input_1", type=int)
    parser.add_argument("--input_2", type=int)
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    main(args)