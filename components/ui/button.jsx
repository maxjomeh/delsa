import React from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva} from 'class-variance-authority';
import clsx from 'clsx';
import styles from './button.module.css';
const buttonVariants=cva(styles.button,{variants:{variant:{default:styles.primary,outline:styles.outline,ghost:styles.ghost},size:{default:styles.default,sm:styles.small,lg:styles.large}},defaultVariants:{variant:'default',size:'default'}});
export function Button({asChild=false,variant,size,className='',...props}){const Comp=asChild?Slot:'button';return <Comp className={clsx(buttonVariants({variant,size}),className)} {...props}/>;}
