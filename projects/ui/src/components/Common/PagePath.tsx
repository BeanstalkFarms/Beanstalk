import { Link, Typography } from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { FC } from '~/types';

export type PathItem = {
  title: string;
  path: string;
};

const PagePath: FC<{
  items: PathItem[];
}> = (props) => (
  <div>
    {props.items.map((item, index) => {
      const isLastItem = props.items.length - 1 === index;
      return (
        <span key={index}>
          <Link
            component={RouterLink}
            to={item.path}
            sx={{
              color: isLastItem ? 'text.primary' : 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
            display="inline"
            underline="none"
            variant="h4"
            mr={1}
          >
            {item.title}
          </Link>
          {isLastItem ? null : (
            <Typography
              color="text.secondary"
              display="inline"
              variant="h4"
              mr={1}
            >
              {'>'}
            </Typography>
          )}
        </span>
      );
    })}
  </div>
);

export default PagePath;
